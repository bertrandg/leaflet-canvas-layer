if(typeof(L) !== 'undefined') {
    
    L.CanvasLayer = L.Layer.extend({
        options: this.options || {},

        initialize: function() {
            this._myCanvas = document.createElement('canvas');
            this.options.filterColor = this.options.filterColor || null;
            this.options.filterType = this.options.filterType || null;
            this.options.pointViz = this.options.pointViz || 'RECT';
            this.options.boundExtendMeters = this.options.boundExtendMeters || 30000;
            this.options.drawOnDrag = this.options.drawOnDrag || true;

            this.imagered = new Image(22, 33);
            this.imagered.src = './images/marker_red.png';

            this.imageyellow = new Image(22, 33);
            this.imageyellow.src = './images/marker_yellow.png';

            this.imageblue = new Image(22, 33);
            this.imageblue.src = './images/marker_blue.png';
        },

        setData: function(data) {
            var bounds = new L.LatLngBounds([-90, -180], [90,180]);
            this._myQuad = new QuadTree(this.boundsToQuery(bounds), false, 10, 10);

            data.forEach(d => this._myQuad.insert({x: d.lat, y: d.lon, data: d}));
            this.drawCanvas();
        },
        
        addData: function(arr) {
            this._myQuad.insert(arr.map(d => ({x: d.lat, y: d.lon, data: d})));
            this.drawCanvas();
        },

        onAdd: function (map) {
            this._myMap = map;

            const myPane = map.getPane('leaflet-canvas-pane') || map.createPane('leaflet-canvas-pane');
            myPane.appendChild(this._myCanvas);

            map.on('viewreset resize', this.canvasReset, this);
            
            map.on('movestart', this.moveStart, this);
            map.on('move', this.move, this);
            map.on('moveend', this.moveEnd, this);

            map.on('zoomstart', this.zoomStart, this);
            map.on('zoomend', this.zoomEnd, this);
            
            map.on('click', this.handleClick, this);

            this.canvasReset();
        },
        
        moveStart: function(e) {
            if(!this.options.drawOnDrag) this._myCanvas.style.opacity = 0;
        },
        move: function(e) {
            if(this.options.drawOnDrag) this.drawCanvas();
        },
        moveEnd: function(e) {
            this.drawCanvas();
            this._myCanvas.style.opacity = 1;
        },
        
        zoomStart: function(e) {
            this._myCanvas.style.opacity = 0;
        },
        zoomEnd: function(e) {
            this._myCanvas.style.opacity = 1;
        },

        handleClick: function(e) {
            if(!this._myQuad) return;

            const j = e.containerPoint;
            const sizePoint = this.getPointSize();

            const bounds = L.latLngBounds(map.containerPointToLatLng(j.add(L.point(sizePoint/2,sizePoint/2))), map.containerPointToLatLng(j.subtract(L.point(sizePoint/2,sizePoint/2))))
            const points = this._myQuad.retrieveInBounds(this.boundsToQuery(bounds));
            const filteredPoints = this.options.filterColor ? points.filter(p => p.data.color === this.options.filterColor) : points;

            if(filteredPoints.length > 0) {
                this.clickedPoints(filteredPoints, e);
            }
        },
        
        clickedPoints: function(points, e) {
        },

        addLayerTo: function (map) {
            map.addLayer(this);
            return this;
        },

        addTo: function(map) {
            this.addLayerTo(map);
            return this;
        },

        getCanvas: function () {
            return this._myCanvas;
        },

        getOptions: function () {
            return this.options;
        },

        canvasReset: function() {
            const size = this._myMap.getSize();
            this._myCanvas.width = size.x;
            this._myCanvas.height = size.y;
            this.drawCanvas();
        },

        onRemove: function (map) {
            map._container.removeChild(this._staticPane);

            map.off('viewreset resize', this.canvasReset, this);
            
            map.off('movestart', this.moveStart, this);
            map.off('move', this.move, this);
            map.off('moveend', this.moveEnd, this);

            map.off('zoomstart', this.zoomStart, this);
            map.off('zoomend', this.zoomEnd, this);
            
            map.off('click', this.handleClick, this);
        },
        
        redraw: function() {
            this.drawCanvas();
        },
        
        boundsToQuery: function(bounds) {
            return {
                x: bounds.getSouthWest().lat,
                y: bounds.getSouthWest().lng,
                width: bounds.getNorthEast().lat - bounds.getSouthWest().lat,
                height: bounds.getNorthEast().lng - bounds.getSouthWest().lng
            };
        },

        drawCanvas: function() {
            if(!this._myQuad) return;

            const canvas = this.getCanvas();
            const ctx = canvas.getContext('2d');

            // Calculate the offset of the top-left corner of the map, relative to
            // the [0,0] coordinate of the DOM container for the map's main pane
            var offset = map.containerPointToLayerPoint([0, 0]);
            L.DomUtil.setPosition(canvas, offset);
            
            const b = this._myMap.getBounds();
            const latRadius = this._getLatRadius(this.options.boundExtendMeters);
            const lngRadius = this._getLngRadius(this.options.boundExtendMeters, b.getSouthWest().lat);
            const southWest = new L.LatLng(b.getSouthWest().lat - latRadius, b.getSouthWest().lng - lngRadius);
            const northEast = new L.LatLng(b.getNorthEast().lat + latRadius, b.getNorthEast().lng + lngRadius);
            const bounds = new L.latLngBounds(southWest, northEast);
            const points = this._myQuad.retrieveInBounds(this.boundsToQuery(bounds));

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let visiblePoints = 0;

            points.forEach(point => {
                const data = point.data;
                const pointPx = this._myMap.latLngToContainerPoint(new L.LatLng(data.lat, data.lon));

                if( (!this.options.filterColor || this.options.filterColor === data.color)
                    &&
                    (!this.options.filterType || this.options.filterType === data.type) )
                {
                    this.drawPoint(pointPx, data);
                    visiblePoints++;
                }
            });

            this.drawedCanvas(visiblePoints);
        },

        drawedCanvas: function(nbPoints) {
        },

        drawPoint: function(point, data) {
            const ctx = this.getCanvas().getContext('2d');
            ctx.beginPath();
            
            // POINT + CIRCLE
            if(data.radiusMeters) {
                const lngRadius = this._getLngRadius(data.radiusMeters, data.lat);
                const latlng = new L.LatLng(data.lat, data.lon);
                const pointLeft = this._myMap.latLngToContainerPoint([latlng.lat, latlng.lng - lngRadius]);
                const radius = Math.max(point.x - pointLeft.x, 1);
                ctx.fillStyle = data.color;//'rgba(0, 0, 0, .3)';
                ctx.arc(point.x, point.y, radius, 0, 2 * Math.PI);
                ctx.fill();
            }
            // ELLIPSE
            else if(data.orient) {
                const lngRadius = this._getLngRadius(data.semiMajorMeters, data.lat);
                const latRadius = this._getLatRadius(data.semiMinorMeters);
                const latlng = new L.LatLng(data.lat, data.lon);
                const pointLeft = this._myMap.latLngToContainerPoint([latlng.lat, latlng.lng - lngRadius]);
                const pointBelow = this._myMap.latLngToContainerPoint([latlng.lat - latRadius, latlng.lng]);

                const radiusX = Math.max(point.x - pointLeft.x, 1);
                const radiusY = Math.max(pointBelow.y - point.y, 1);
                const tilt = Math.PI * data.orient / 180;

                ctx.lineWidth = 1;
                ctx.strokeStyle = data.color;
                ctx.ellipse(point.x, point.y, radiusX, radiusY, tilt, 0, 2*Math.PI);
                ctx.stroke();
                
            }
            // POINT
            else {
                if(this.options.pointViz === 'RECT') {
                    const sizePoint = this.getPointSize();
                    ctx.fillStyle = data.color;
                    ctx.rect(point.x - sizePoint/2, point.y - sizePoint/2, sizePoint, sizePoint);
                    ctx.fill();
                }
                else {
                    ctx.drawImage(this['image' + data.color], point.x - 11, point.y - 33, 22, 33);
                }
            }

        },
        
        filterColor: function(color) {
            this.options.filterColor = color;
            this.redraw();
        },
        
        filterType: function(type) {
            this.options.filterType = type;
            this.redraw();
        },
        
        setPointViz: function(mode) {
            this.options.pointViz = mode;
            this.redraw();
        },
        
        setDrawOnDrag: function(v) {
            this.options.drawOnDrag = v;
            this.redraw();
        },

        getPointSize: function() {
            const z = this._myMap.getZoom();

            switch(true) {
                case z > 9:     return 20;
                default:        return 4;
            }
        },

        // HELPERS

        _getLatRadius: function(mRadiusY) {
            return (mRadiusY / 40075017) * 360;
        },

        _getLngRadius: function(mRadiusX, lat) {
            return ((mRadiusX / 40075017) * 360) / Math.cos((Math.PI / 180) * lat);
        },
    });

}

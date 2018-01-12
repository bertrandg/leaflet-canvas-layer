//@ts-check


const map = L.map('map', {
    center: new L.LatLng(47.200391, 4.371231),
    zoom: 8
});

setTimeout(() => {
    map.setView(new L.LatLng(47.200391, 4.371231), 8);
});

const tileLayer = L.tileLayer('http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {});
map.addLayer(tileLayer);

const popup = L.popup().setLatLng([0, 0]);
map.addLayer(popup);
map.closePopup(popup);

const marker = L.marker([51.5048, -0.09]).addTo(map);

// Create custom canvas layer

const canvasLayer = new L.CanvasLayer();
map.addLayer(canvasLayer);

canvasLayer.clickedPoints = function(points, ev) {
    popup.setLatLng([points[0].data.lat, points[0].data.lon])
        .setContent(points.map(p => `lat: ${ p.data.lat } - lon: ${ p.data.lon }<br>color: ${ p.data.color }`).join(`<br>`))
        .openOn(map);
}

canvasLayer.drawedCanvas = function(nb) {
    document.getElementById('nbResults').innerText = nb;
}

// Add ellipses with random color

const ellipseModel = {
    lat: 51.5048,
    lng: -0.09,
    radiiSemiMajorAxis: 100,
    radiiSemiMinorAxis: 5,
    angle: -50
};

const pointsEllipse = Array.from(Array(10000)).map(() => {
    ellipseModel.lat -= Math.random()/200;
    ellipseModel.lng += Math.random()/200;
    ellipseModel.radiiSemiMajorAxis += (Math.random()*10 - Math.random()*6);
    ellipseModel.radiiSemiMinorAxis += (Math.random()*6 - Math.random()*4);
    ellipseModel.angle += (Math.random()*20 - Math.random()*10);

    return {
        type: 'EL',
        lat: ellipseModel.lat,
        lon: ellipseModel.lng,
        color: getRandomColor(),
        semiMajorMeters: ellipseModel.radiiSemiMajorAxis,
        semiMinorMeters: ellipseModel.radiiSemiMinorAxis,
        orient: ellipseModel.angle
    }
});

canvasLayer.setData(pointsEllipse);

// Add cities with random shape/color

fetch('./cities.json')
    .then(res => res.json())
    .then(pts => _.map(pts, convertCityToRandom))
    .then(pts => {console.log(pts); canvasLayer.addData(pts)});



// UTILS
             
function convertCityToRandom(c, i) {
    const p = {
        type: 'PT',
        lat: c[0], 
        lon: c[1], 
        color: getRandomColor()
    };

    if(i % 5 === 0) {
        p.type = 'CI';
        p.radiusMeters = getRandomInt(200, 2800);
    }
    else if(i % 77 === 0) {
        p.type = 'EL';
        p.semiMajorMeters = getRandomInt(300, 1600);
        p.semiMinorMeters = getRandomInt(300, 1600);
        p.orient = getRandomInt(0, 360);
    }

    return p;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

function getRandomColor() {
    const colors = ['red', 'yellow', 'blue'];
    return colors[Math.floor(Math.random() * colors.length)];
}

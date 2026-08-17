const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');

function parseCoordinates(coordStr) {
  return coordStr
    .trim()
    .split(/\s+/)
    .filter(c => c.length > 0)
    .map(c => {
      const parts = c.split(',');
      const lng = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      return [lng, lat];
    })
    .filter(([lng, lat]) => !isNaN(lng) && !isNaN(lat));
}

function getTextContent(el, tag) {
  const node = el.getElementsByTagName(tag)[0];
  return node && node.textContent ? node.textContent.trim() : '';
}

const kmlPath = 'Bản sao của Bản sao của Ranh giới 12 TDP Hòa 13 Liên củ 12.kml';
const kmlText = fs.readFileSync(kmlPath, 'utf8');
const parser = new DOMParser();
const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

const folders = xmlDoc.getElementsByTagName('Folder');
console.log(`Found ${folders.length} Folders:`);
for (let i = 0; i < folders.length; i++) {
  const f = folders[i];
  const fName = getTextContent(f, 'name');
  const pms = f.getElementsByTagName('Placemark');
  const poly = f.getElementsByTagName('Polygon').length;
  const line = f.getElementsByTagName('LineString').length;
  const pt = f.getElementsByTagName('Point').length;
  console.log(`- Folder "${fName}": ${pms.length} placemarks (Poly: ${poly}, Line: ${line}, Point: ${pt})`);
}

console.log('Type counts:', typeCounts);
console.log('Sample placemarks:', samples);

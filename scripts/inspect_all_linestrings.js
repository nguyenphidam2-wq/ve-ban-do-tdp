const fs = require('fs');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

function getTextContent(el, tag) {
  const node = el.getElementsByTagName(tag)[0];
  return node && node.textContent ? node.textContent.trim() : '';
}

function parseCoordinates(coordStr) {
  return coordStr
    .trim()
    .split(/\s+/)
    .filter(c => c.length > 0)
    .map(c => {
      const parts = c.split(',');
      return [parseFloat(parts[0]), parseFloat(parts[1])];
    })
    .filter(([lng, lat]) => !isNaN(lng) && !isNaN(lat));
}

async function main() {
  const kmzPath = 'ĐỀ ÁN SÁT NHẬP TỔ DÂN PHỐ 25.6.kmz';
  const buffer = fs.readFileSync(kmzPath);
  const zip = await JSZip.loadAsync(buffer);

  let kmlFile = null;
  zip.forEach((relativePath, file) => {
    if (!file.dir && relativePath.toLowerCase().endsWith('.kml')) {
      kmlFile = file;
    }
  });

  const kmlText = await kmlFile.async('text');
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

  const placemarks = xmlDoc.getElementsByTagName('Placemark');
  console.log('--- TỔNG HỢP CÁC ĐỐI TƯỢNG VÙNG & ĐƯỜNG TRONG KMZ ---');
  let count = 0;
  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const name = getTextContent(placemark, 'name') || 'Không tên';

    const lines = placemark.getElementsByTagName('LineString');
    for (let l = 0; l < lines.length; l++) {
      const coordNode = lines[l].getElementsByTagName('coordinates')[0];
      if (coordNode) {
        const coords = parseCoordinates(coordNode.textContent);
        console.log(`[LineString ${++count}] Name: "${name}" (${coords.length} điểm)`);
      }
    }

    const polys = placemark.getElementsByTagName('Polygon');
    for (let p = 0; p < polys.length; p++) {
      console.log(`[Polygon    ${++count}] Name: "${name}"`);
    }
  }
}

main().catch(console.error);

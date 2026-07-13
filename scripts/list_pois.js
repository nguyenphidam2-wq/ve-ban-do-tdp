const fs = require('fs');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');

function getTextContent(el, tag) {
  const node = el.getElementsByTagName(tag)[0];
  return node && node.textContent ? node.textContent.trim() : '';
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
  const pois = [];

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const name = getTextContent(placemark, 'name') || 'Không tên';
    const desc = getTextContent(placemark, 'description') || '';
    const points = placemark.getElementsByTagName('Point');
    if (points.length > 0) {
      pois.push({ idx: pois.length + 1, name, desc });
    }
  }

  console.log(`TỔNG SỐ ĐIỂM (POI): ${pois.length}\n`);
  pois.forEach(p => {
    console.log(`${String(p.idx).padStart(2, '0')}. ${p.name}`);
  });
}

main().catch(console.error);

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
  console.log(`TỔNG SỐ PLACEMARK TRONG TỆP KMZ: ${placemarks.length}\n`);

  let polyCount = 0;
  let pointCount = 0;
  let lineCount = 0;
  const names = [];

  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const name = getTextContent(placemark, 'name') || 'Không tên';
    const hasPoly = placemark.getElementsByTagName('Polygon').length > 0;
    const hasPoint = placemark.getElementsByTagName('Point').length > 0;
    const hasLine = placemark.getElementsByTagName('LineString').length > 0;

    let typeStr = '';
    if (hasPoly) { polyCount++; typeStr = 'Vùng (Polygon)'; }
    else if (hasPoint) { pointCount++; typeStr = 'Điểm (Point)'; }
    else if (hasLine) { lineCount++; typeStr = 'Đường (LineString)'; }
    else { typeStr = 'Khác'; }

    names.push({ idx: i + 1, name, type: typeStr });
  }

  console.log(`Thống kê theo loại:`);
  console.log(`- Vùng (Polygon): ${polyCount}`);
  console.log(`- Điểm (Point): ${pointCount}`);
  console.log(`- Đường (LineString): ${lineCount}\n`);

  console.log('DANH SÁCH CHI TIẾT (15 đối tượng đầu tiên):');
  names.slice(0, 15).forEach(item => {
    console.log(`  [${item.idx}] ${item.name} -> ${item.type}`);
  });

  if (names.length > 15) {
    console.log(`  ... và ${names.length - 15} đối tượng khác.`);
  }
}

main().catch(console.error);

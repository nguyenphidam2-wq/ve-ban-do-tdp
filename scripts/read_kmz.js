const fs = require('fs');
const JSZip = require('jszip');
const { DOMParser } = require('@xmldom/xmldom');
const mongoose = require('mongoose');

function getMongoURI() {
  try {
    const envContent = fs.readFileSync('.env.local', 'utf8');
    const match = envContent.match(/MONGODB_URI=(.*)/);
    if (match && match[1]) {
      return match[1].trim();
    }
  } catch (e) {}
  return null;
}

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

function sanitizePolygonRing(coords) {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  const valid = coords.filter(p => Array.isArray(p) && p.length >= 2 && !isNaN(p[0]) && !isNaN(p[1]));
  if (valid.length === 0) return [];

  const deduped = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = valid[i];
    if (Math.abs(prev[0] - curr[0]) > 1e-8 || Math.abs(prev[1] - curr[1]) > 1e-8) {
      deduped.push(curr);
    }
  }

  if (deduped.length >= 3) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-8 || Math.abs(first[1] - last[1]) > 1e-8) {
      deduped.push([first[0], first[1]]);
    }
  }

  if (deduped.length < 4) return [];
  return deduped;
}

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
  console.log(`Found ${placemarks.length} Placemarks in KMZ.`);

  const features = [];
  for (let i = 0; i < placemarks.length; i++) {
    const placemark = placemarks[i];
    const name = getTextContent(placemark, 'name') || 'Không tên';
    const description = getTextContent(placemark, 'description') || '';

    const polygons = placemark.getElementsByTagName('Polygon');
    for (let p = 0; p < polygons.length; p++) {
      const poly = polygons[p];
      const outerCoordNodes = poly.getElementsByTagName('coordinates');
      if (outerCoordNodes.length > 0) {
        const coords = parseCoordinates(outerCoordNodes[0].textContent);
        const ring = sanitizePolygonRing(coords);
        if (ring.length >= 4) {
          features.push({
            name,
            notes: description,
            type: 'Polygon',
            geometry: {
              type: 'Polygon',
              coordinates: [ring]
            }
          });
        }
      }
    }

    const points = placemark.getElementsByTagName('Point');
    for (let pt = 0; pt < points.length; pt++) {
      const point = points[pt];
      const coordNodes = point.getElementsByTagName('coordinates');
      if (coordNodes.length > 0) {
        const coords = parseCoordinates(coordNodes[0].textContent);
        if (coords.length > 0) {
          features.push({
            name,
            notes: description,
            type: 'Point',
            geometry: {
              type: 'Point',
              coordinates: coords[0]
            }
          });
        }
      }
    }
  }

  // Group summary by name
  const summary = {};
  features.forEach(f => {
    summary[f.name] = (summary[f.name] || 0) + 1;
  });

  console.log('\n--- DANH SÁCH CÁC ĐỐI TƯỢNG TRONG TỆP KMZ ---');
  Object.entries(summary).forEach(([name, count], idx) => {
    console.log(`${idx + 1}. ${name} (${count} đối tượng)`);
  });

  const uri = getMongoURI();
  if (uri) {
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const zonesCol = db.collection('zones');
    const poisCol = db.collection('pois');

    let zoneCount = 0;
    let poiCount = 0;

    for (const f of features) {
      try {
        if (f.type === 'Polygon') {
          await zonesCol.insertOne({
            type: 'Feature',
            geometry: f.geometry,
            properties: {
              name: f.name,
              area: 0,
              officer: 'ĐỀ ÁN 25.6',
              population: 0,
              households: 0,
              status: 'active',
              createdAt: new Date(),
              updatedAt: new Date()
            }
          });
          zoneCount++;
        } else if (f.type === 'Point') {
          await poisCol.insertOne({
            type: 'Feature',
            geometry: f.geometry,
            properties: {
              name: f.name,
              notes: f.notes,
              type: 'info',
              createdAt: new Date()
            }
          });
          poiCount++;
        }
      } catch (err) {
        console.warn(`[SKIP] Lỗi khi thêm "${f.name}" (${f.type}): ${err.message}`);
      }
    }

    console.log(`\n=> Đã nhập thành công vào MongoDB: ${zoneCount} vùng (Zones) và ${poiCount} điểm (POIs).`);
    await mongoose.disconnect();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

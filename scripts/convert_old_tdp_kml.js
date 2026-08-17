const fs = require('fs');
const { DOMParser } = require('@xmldom/xmldom');
const turf = require('@turf/turf');

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

function unkinkPolygonGeometry(ring) {
  try {
    const feature = {
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'Polygon',
        coordinates: [ring]
      }
    };
    const unkinked = turf.unkinkPolygon(feature);
    if (unkinked && unkinked.features && unkinked.features.length > 0) {
      if (unkinked.features.length === 1) {
        return unkinked.features[0].geometry;
      } else {
        const polys = unkinked.features.map(f => f.geometry.coordinates);
        return {
          type: 'MultiPolygon',
          coordinates: polys
        };
      }
    }
  } catch (e) {}
  return {
    type: 'Polygon',
    coordinates: [ring]
  };
}

function getTextContent(el, tag) {
  const node = el.getElementsByTagName(tag)[0];
  return node && node.textContent ? node.textContent.trim() : '';
}

const kmlPath = 'Bản sao của Bản sao của Ranh giới 12 TDP Hòa 13 Liên củ 12.kml';
const kmlText = fs.readFileSync(kmlPath, 'utf8');
const parser = new DOMParser();
const xmlDoc = parser.parseFromString(kmlText, 'text/xml');

const placemarks = xmlDoc.getElementsByTagName('Placemark');
console.log(`Processing ${placemarks.length} Placemarks...`);

const features = [];

for (let i = 0; i < placemarks.length; i++) {
  const placemark = placemarks[i];
  const name = getTextContent(placemark, 'name') || 'Không tên';
  const description = getTextContent(placemark, 'description') || '';

  // 1. Polygons
  const polygons = placemark.getElementsByTagName('Polygon');
  for (let p = 0; p < polygons.length; p++) {
    const poly = polygons[p];
    const outerCoordNodes = poly.getElementsByTagName('coordinates');
    if (outerCoordNodes.length > 0) {
      const coords = parseCoordinates(outerCoordNodes[0].textContent);
      const ring = sanitizePolygonRing(coords);
      if (ring.length >= 4) {
        const geom = unkinkPolygonGeometry(ring);
        let area = 0;
        try {
          area = parseFloat((turf.area({ type: 'Feature', geometry: geom }) / 10000).toFixed(4));
        } catch (e) {}

        features.push({
          type: 'Feature',
          id: `old_tdp_poly_${i}_${p}`,
          properties: {
            name,
            description,
            featureType: 'zone',
            area,
            source: '95_TDP_CU'
          },
          geometry: geom
        });
      }
    }
  }

  // 2. LineStrings (if closed, treat as polygon)
  const lines = placemark.getElementsByTagName('LineString');
  for (let l = 0; l < lines.length; l++) {
    const coordNodes = lines[l].getElementsByTagName('coordinates');
    if (coordNodes.length > 0) {
      const coords = parseCoordinates(coordNodes[0].textContent);
      if (coords.length >= 3) {
        const first = coords[0];
        const last = coords[coords.length - 1];
        const isClosed = Math.abs(first[0] - last[0]) < 0.005 && Math.abs(first[1] - last[1]) < 0.005;
        if (isClosed) {
          const ring = sanitizePolygonRing(coords);
          if (ring.length >= 4) {
            const geom = unkinkPolygonGeometry(ring);
            let area = 0;
            try {
              area = parseFloat((turf.area({ type: 'Feature', geometry: geom }) / 10000).toFixed(4));
            } catch (e) {}

            features.push({
              type: 'Feature',
              id: `old_tdp_line_${i}_${l}`,
              properties: {
                name,
                description,
                featureType: 'zone',
                area,
                source: '95_TDP_CU'
              },
              geometry: geom
            });
          }
        }
      }
    }
  }

  // 3. Points
  const points = placemark.getElementsByTagName('Point');
  for (let pt = 0; pt < points.length; pt++) {
    const point = points[pt];
    const coordNodes = point.getElementsByTagName('coordinates');
    if (coordNodes.length > 0) {
      const coords = parseCoordinates(coordNodes[0].textContent);
      if (coords.length > 0) {
        features.push({
          type: 'Feature',
          id: `old_tdp_point_${i}_${pt}`,
          properties: {
            name,
            description,
            featureType: 'poi',
            source: '95_TDP_CU'
          },
          geometry: {
            type: 'Point',
            coordinates: coords[0]
          }
        });
      }
    }
  }
}

const geoJsonCollection = {
  type: 'FeatureCollection',
  name: 'Bản đồ Liên Chiểu 95 tổ dân phố cũ',
  features
};

fs.writeFileSync('public/lien_chieu_95_tdp_cu.geojson', JSON.stringify(geoJsonCollection, null, 2));

const zoneCount = features.filter(f => f.properties.featureType === 'zone').length;
const poiCount = features.filter(f => f.properties.featureType === 'poi').length;

console.log(`Generated GeoJSON at public/lien_chieu_95_tdp_cu.geojson`);
console.log(`- Zones: ${zoneCount}`);
console.log(`- POIs: ${poiCount}`);
console.log(`- Total: ${features.length}`);

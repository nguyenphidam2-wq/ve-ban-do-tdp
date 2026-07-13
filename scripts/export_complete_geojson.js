const fs = require('fs');
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

async function main() {
  const uri = getMongoURI();
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const zonesCol = db.collection('zones');
  const poisCol = db.collection('pois');

  const zones = await zonesCol.find({}).toArray();
  const pois = await poisCol.find({}).toArray();

  console.log(`Exporting ${zones.length} Zones and ${pois.length} POIs...`);

  // Format as clean standard GeoJSON FeatureCollection
  const allFeatures = [];

  // Add zones
  zones.forEach(z => {
    allFeatures.push({
      type: 'Feature',
      id: z._id.toString(),
      geometry: z.geometry,
      properties: {
        feature_type: 'zone',
        name: z.properties?.name || 'Tổ Dân Phố',
        area: z.properties?.area || 0,
        officer: z.properties?.officer || '',
        population: z.properties?.population || 0,
        households: z.properties?.households || 0,
        status: z.properties?.status || 'active'
      }
    });
  });

  // Add POIs
  pois.forEach(p => {
    allFeatures.push({
      type: 'Feature',
      id: p._id.toString(),
      geometry: p.geometry,
      properties: {
        feature_type: 'poi',
        name: p.properties?.name || 'Điểm Chú Ý',
        notes: p.properties?.notes || '',
        type: p.properties?.type || 'info'
      }
    });
  });

  const completeGeoJSON = {
    type: 'FeatureCollection',
    name: 'Đề Án Sát Nhập Tổ Dân Phố 25.6 - Hoàn Chỉnh',
    features: allFeatures
  };

  const zonesOnlyGeoJSON = {
    type: 'FeatureCollection',
    name: 'Đề Án Sát Nhập Tổ Dân Phố 25.6 - Chỉ Ranh Giới Vùng (27 Tổ)',
    features: allFeatures.filter(f => f.properties.feature_type === 'zone')
  };

  // Write to project root
  fs.writeFileSync('Dean_Sat_Nhap_TDP_25_6_Complete.geojson', JSON.stringify(completeGeoJSON, null, 2), 'utf8');
  fs.writeFileSync('Dean_Sat_Nhap_TDP_25_6_Zones_Only.geojson', JSON.stringify(zonesOnlyGeoJSON, null, 2), 'utf8');

  // Also write to public folder if exists
  if (!fs.existsSync('public')) {
    fs.mkdirSync('public');
  }
  fs.writeFileSync('public/Dean_Sat_Nhap_TDP_25_6_Complete.geojson', JSON.stringify(completeGeoJSON, null, 2), 'utf8');
  fs.writeFileSync('public/Dean_Sat_Nhap_TDP_25_6_Zones_Only.geojson', JSON.stringify(zonesOnlyGeoJSON, null, 2), 'utf8');

  console.log('Successfully exported GeoJSON files:');
  console.log('1. Dean_Sat_Nhap_TDP_25_6_Complete.geojson (Đầy đủ 27 Vùng + 57 Điểm)');
  console.log('2. Dean_Sat_Nhap_TDP_25_6_Zones_Only.geojson (Chỉ 27 Vùng Ranh Giới Tổ)');

  await mongoose.disconnect();
}

main().catch(console.error);

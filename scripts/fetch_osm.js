const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// ponytail: force Google DNS to avoid querySrv failure on local DNS servers
dns.setServers(['8.8.8.8', '8.8.4.4']);


// MongoDB Schema Definitions
const POISchema = new mongoose.Schema({
  type: { type: String, default: 'Feature' },
  geometry: {
    type: { type: String, default: 'Point' },
    coordinates: [Number] // [lon, lat]
  },
  properties: {
    name: String,
    notes: String,
    type: String,
    createdAt: { type: Date, default: Date.now }
  }
});

const POI = mongoose.models.POI || mongoose.model('POI', POISchema);

const MONGODB_URI = 'mongodb+srv://admin:M2QKeyQwumScBLuN@cluster0.129xiqk.mongodb.net/ve_ban_do?appName=Cluster0';

async function fetchOSMData() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected successfully!');

  // Overpass query for Lien Chieu area using a bounding box to avoid area resolution timeout
  const bbox = '16.05,108.08,16.15,108.18';
  const query = `[out:json][timeout:30];
(
  node(${bbox})["amenity"];
  node(${bbox})["shop"];
  node(${bbox})["emergency"];
  node(${bbox})["tourism"];
);
out body;`;

  console.log('Fetching data from OSM Overpass API...');
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'GisDigitizerPro/1.0 (contact: admin@example.com)'
      }
    });
    if (!response.ok) {
      throw new Error(`OSM Fetch failed: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    const elements = data.elements || [];
    console.log(`Successfully fetched ${elements.length} raw elements from OSM.`);

    let insertedCount = 0;
    let skippedCount = 0;
    const geojsonFeatures = [];

    for (const element of elements) {
      const tags = element.tags || {};
      const name = tags.name || tags.brand || tags.operator || `Điểm OSM (${element.id})`;
      const lon = element.lon;
      const lat = element.lat;
      
      if (!lon || !lat) continue;

      // Map OSM tag to our project POI type
      let type = 'info';
      const amenity = tags.amenity || '';
      const shop = tags.shop || '';
      const emergency = tags.emergency || '';
      
      if (amenity === 'fire_station' || amenity === 'fire_hydrant' || emergency === 'fire_hydrant') {
        type = 'fire';
      } else if (amenity === 'surveillance' || tags.man_made === 'surveillance_camera') {
        type = 'camera';
      } else if (amenity === 'police' || amenity === 'hospital' || amenity === 'pharmacy') {
        type = 'warning';
      }

      const notes = `Địa chỉ/Loại: ${amenity || shop || 'POI'}. Nguồn: OpenStreetMap (ID: ${element.id})`;

      const feature = {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [lon, lat]
        },
        properties: {
          name,
          notes,
          type
        }
      };
      geojsonFeatures.push(feature);

      // Check if duplicate exists in DB (same coordinates or same name + type)
      const existing = await POI.findOne({
        $or: [
          { 'geometry.coordinates': [lon, lat] },
          { 'properties.name': name }
        ]
      });

      if (!existing) {
        await POI.create(feature);
        insertedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(`Saved ${insertedCount} new POIs to MongoDB. Skipped ${skippedCount} duplicate POIs.`);

    // Write to a local GeoJSON file too
    const geojson = {
      type: 'FeatureCollection',
      features: geojsonFeatures
    };
    const outputPath = path.join(__dirname, '..', 'public', 'osm_pois_lien_chieu.geojson');
    fs.writeFileSync(outputPath, JSON.stringify(geojson, null, 2));
    console.log(`Successfully wrote GeoJSON file to: ${outputPath}`);

  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB.');
  }
}

fetchOSMData();

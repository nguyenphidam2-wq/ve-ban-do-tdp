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

async function clearData() {
  const uri = getMongoURI();
  if (!uri) {
    console.error('Missing MONGODB_URI');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB...');

  const db = mongoose.connection.db;
  const zonesCol = db.collection('zones');
  const poisCol = db.collection('pois');

  const zoneDel = await zonesCol.deleteMany({});
  const poiDel = await poisCol.deleteMany({});

  console.log(`Successfully deleted ${zoneDel.deletedCount} zones and ${poiDel.deletedCount} POIs.`);
  await mongoose.disconnect();
}

clearData().catch(err => {
  console.error(err);
  process.exit(1);
});

import mongoose from 'mongoose';
import dns from 'dns';

// ponytail: Force Google DNS on server-side to resolve MongoDB SRV records
if (typeof window === 'undefined') {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gis_database';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cached = (global as any).mongoose;

if (!cached) {
  cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
  }
  cached.conn = await cached.promise;
  return cached.conn;
}

export default dbConnect;

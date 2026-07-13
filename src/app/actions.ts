'use server';

import dbConnect from '@/lib/db';
import Zone from '@/models/Zone';
import POI from '@/models/POI';
import { revalidatePath } from 'next/cache';
import { sanitizeGeoJSONGeometry } from '@/utils/geoSanitizer';

export async function saveZone(formData: any) {
  try {
    await dbConnect();
    
    const { geometry, properties } = formData;
    const sanitizedGeometry = sanitizeGeoJSONGeometry(geometry) || geometry;
    
    const newZone = await Zone.create({
      geometry: sanitizedGeometry,
      properties
    });
    
    revalidatePath('/');
    return { success: true, data: JSON.parse(JSON.stringify(newZone)) };
  } catch (error: any) {
    console.error('Error saving zone:', error);
    return { success: false, error: error.message };
  }
}

export async function getZones() {
  try {
    await dbConnect();
    const zones = await Zone.find({}).lean();
    return { success: true, data: JSON.parse(JSON.stringify(zones)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function savePoi(formData: any) {
  try {
    await dbConnect();
    const { geometry, properties } = formData;
    const newPoi = await POI.create({
      geometry,
      properties
    });
    revalidatePath('/');
    return { success: true, data: JSON.parse(JSON.stringify(newPoi)) };
  } catch (error: any) {
    console.error('Error saving POI:', error);
    return { success: false, error: error.message };
  }
}

export async function getPois() {
  try {
    await dbConnect();
    const pois = await POI.find({}).lean();
    return { success: true, data: JSON.parse(JSON.stringify(pois)) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteZone(id: string) {
  try {
    await dbConnect();
    await Zone.findByIdAndDelete(id);
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting zone:', error);
    return { success: false, error: error.message };
  }
}

export async function deletePoi(id: string) {
  try {
    await dbConnect();
    await POI.findByIdAndDelete(id);
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error deleting POI:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteAllZones() {
  try {
    await dbConnect();
    const res = await Zone.deleteMany({});
    revalidatePath('/');
    return { success: true, count: res.deletedCount };
  } catch (error: any) {
    console.error('Error deleting all zones:', error);
    return { success: false, error: error.message };
  }
}

export async function deleteAllFeatures() {
  try {
    await dbConnect();
    const zoneRes = await Zone.deleteMany({});
    const poiRes = await POI.deleteMany({});
    revalidatePath('/');
    return { 
      success: true, 
      zoneCount: zoneRes.deletedCount,
      poiCount: poiRes.deletedCount 
    };
  } catch (error: any) {
    console.error('Error deleting all features:', error);
    return { success: false, error: error.message };
  }
}


export async function updateZoneProperties(id: string, properties: any) {
  try {
    await dbConnect();
    await Zone.findByIdAndUpdate(id, { $set: { properties } });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating zone properties:', error);
    return { success: false, error: error.message };
  }
}

export async function updatePoiProperties(id: string, properties: any) {
  try {
    await dbConnect();
    await POI.findByIdAndUpdate(id, { $set: { properties } });
    revalidatePath('/');
    return { success: true };
  } catch (error: any) {
    console.error('Error updating POI properties:', error);
    return { success: false, error: error.message };
  }
}

export async function importFeatures(features: any[]) {
  try {
    await dbConnect();
    let zoneCount = 0;
    let poiCount = 0;

    for (const feature of features) {
      if (!feature.geometry || !feature.geometry.type) continue;
      
      const geometryType = feature.geometry.type;
      const properties = feature.properties || {};
      const name = properties.name || `Nhập khẩu ${geometryType}`;

      if (geometryType === 'Polygon' || geometryType === 'MultiPolygon') {
        const sanitizedGeometry = sanitizeGeoJSONGeometry(feature.geometry);
        if (!sanitizedGeometry) {
          console.warn('Skipping invalid polygon geometry for feature:', name);
          continue;
        }

        await Zone.create({
          geometry: sanitizedGeometry,
          properties: {
            name,
            area: properties.area || 0,
            officer: properties.officer || 'Imported',
            population: properties.population || 0,
            households: properties.households || 0,
            status: properties.status || 'active',
            customFields: properties.customFields || {}
          }
        });
        zoneCount++;
      } else if (geometryType === 'Point') {
        const sanitizedGeometry = sanitizeGeoJSONGeometry(feature.geometry);
        if (!sanitizedGeometry) continue;

        await POI.create({
          geometry: sanitizedGeometry,
          properties: {
            name,
            notes: properties.notes || '',
            type: properties.type || 'warning'
          }
        });
        poiCount++;
      }
    }

    revalidatePath('/');
    return { 
      success: true, 
      count: zoneCount + poiCount, 
      zones: zoneCount, 
      pois: poiCount
    };
  } catch (error: any) {
    console.error('Error importing features:', error);
    return { success: false, error: error.message };
  }
}


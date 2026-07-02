'use server';

import dbConnect from '@/lib/db';
import Zone from '@/models/Zone';
import POI from '@/models/POI';
import { revalidatePath } from 'next/cache';

export async function saveZone(formData: any) {
  try {
    await dbConnect();
    
    const { geometry, properties } = formData;
    
    const newZone = await Zone.create({
      geometry,
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

'use server';

import dbConnect from '@/lib/db';
import Zone from '@/models/Zone';
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

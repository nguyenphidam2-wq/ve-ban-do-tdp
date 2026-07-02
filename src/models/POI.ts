import mongoose, { Schema, model, models } from 'mongoose';

const POISchema = new Schema({
  type: {
    type: String,
    enum: ['Feature'],
    required: true,
    default: 'Feature'
  },
  geometry: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  properties: {
    name: { type: String, required: true },
    notes: { type: String },
    type: { type: String, default: 'warning' }, // warning, info, camera, fire
    createdAt: { type: Date, default: Date.now }
  }
});

POISchema.index({ geometry: '2dsphere' });

export default models.POI || model('POI', POISchema);

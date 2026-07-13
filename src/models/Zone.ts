import mongoose, { Schema, model, models } from 'mongoose';

const ZoneSchema = new Schema({
  type: {
    type: String,
    enum: ['Feature'],
    required: true,
    default: 'Feature'
  },
  geometry: {
    type: {
      type: String,
      enum: ['Polygon', 'MultiPolygon'],
      required: true
    },
    coordinates: {
      type: Schema.Types.Mixed, // For Polygon and MultiPolygon
      required: true
    }
  },
  properties: {
    name: { type: String, required: true },
    area: { type: Number },
    officer: { type: String },
    population: { type: Number, default: 0 },
    households: { type: Number, default: 0 },
    status: { type: String, default: 'active' },
    customFields: { type: Map, of: String }, // For dynamic properties
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
  }
});

// Index for spatial queries
ZoneSchema.index({ geometry: '2dsphere' });

export default models.Zone || model('Zone', ZoneSchema);

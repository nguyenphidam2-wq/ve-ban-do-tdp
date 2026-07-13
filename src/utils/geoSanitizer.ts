// @ts-ignore
import * as turf from '@turf/turf';

export function sanitizePolygonRing(coords: number[][]): number[][] {
  if (!Array.isArray(coords) || coords.length === 0) return [];
  
  // 1. Filter out invalid/NaN coordinates and limit to 2 dimensions [lng, lat]
  const valid = coords
    .filter(p => Array.isArray(p) && p.length >= 2 && !isNaN(Number(p[0])) && !isNaN(Number(p[1])))
    .map(p => [Number(p[0]), Number(p[1])]);

  if (valid.length === 0) return [];

  // 2. Remove consecutive duplicates
  const deduped: number[][] = [valid[0]];
  for (let i = 1; i < valid.length; i++) {
    const prev = deduped[deduped.length - 1];
    const curr = valid[i];
    if (Math.abs(prev[0] - curr[0]) > 1e-8 || Math.abs(prev[1] - curr[1]) > 1e-8) {
      deduped.push(curr);
    }
  }

  // 3. Ensure the ring is closed (first point === last point)
  if (deduped.length >= 3) {
    const first = deduped[0];
    const last = deduped[deduped.length - 1];
    if (Math.abs(first[0] - last[0]) > 1e-8 || Math.abs(first[1] - last[1]) > 1e-8) {
      deduped.push([first[0], first[1]]);
    }
  }

  // 4. Must have at least 4 points for a valid closed polygon ring in GeoJSON RFC 7946
  if (deduped.length < 4) return [];

  return deduped;
}

export function sanitizeGeoJSONGeometry(geometry: any): any | null {
  if (!geometry || !geometry.type || !geometry.coordinates) return null;

  try {
    if (geometry.type === 'Polygon') {
      const rings: number[][][] = [];
      for (const ring of geometry.coordinates) {
        if (Array.isArray(ring)) {
          const cleaned = sanitizePolygonRing(ring);
          if (cleaned.length >= 4) {
            rings.push(cleaned);
          }
        }
      }
      if (rings.length === 0) return null;
      
      const feature = {
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'Polygon' as const,
          coordinates: rings
        }
      };

      try {
        const cleanedFeature = turf.cleanCoords(feature);
        const unkinked = turf.unkinkPolygon(cleanedFeature);
        if (unkinked && unkinked.features && unkinked.features.length > 0) {
          if (unkinked.features.length === 1) {
            return unkinked.features[0].geometry;
          } else {
            return {
              type: 'MultiPolygon',
              coordinates: unkinked.features.map((f: any) => f.geometry.coordinates)
            };
          }
        }
        return cleanedFeature.geometry;
      } catch (e) {
        return { type: 'Polygon', coordinates: rings };
      }
    } else if (geometry.type === 'MultiPolygon') {
      const multiPolys: number[][][][] = [];
      for (const poly of geometry.coordinates) {
        if (Array.isArray(poly)) {
          const rings: number[][][] = [];
          for (const ring of poly) {
            if (Array.isArray(ring)) {
              const cleaned = sanitizePolygonRing(ring);
              if (cleaned.length >= 4) {
                rings.push(cleaned);
              }
            }
          }
          if (rings.length > 0) {
            multiPolys.push(rings);
          }
        }
      }
      if (multiPolys.length === 0) return null;
      if (multiPolys.length === 1) {
        return { type: 'Polygon', coordinates: multiPolys[0] };
      }
      return { type: 'MultiPolygon', coordinates: multiPolys };
    } else if (geometry.type === 'Point') {
      const coords = geometry.coordinates;
      if (Array.isArray(coords) && coords.length >= 2 && !isNaN(Number(coords[0])) && !isNaN(Number(coords[1]))) {
        return { type: 'Point', coordinates: [Number(coords[0]), Number(coords[1])] };
      }
      return null;
    } else if (geometry.type === 'LineString') {
      return geometry;
    }
  } catch (err) {
    console.warn('Geometry sanitization error:', err);
  }

  return geometry;
}

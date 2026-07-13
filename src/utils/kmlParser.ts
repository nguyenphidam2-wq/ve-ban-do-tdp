// @ts-ignore
import * as turf from '@turf/turf';
import JSZip from 'jszip';
import { sanitizeGeoJSONGeometry } from '@/utils/geoSanitizer';


export function parseKMLToGeoJSON(kmlText: string): any[] {
  if (typeof window === 'undefined') return [];
  
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Đọc tệp KML thất bại: Cấu trúc XML không hợp lệ.');
  }

  const features: any[] = [];
  const placemarks = xmlDoc.querySelectorAll('Placemark');

  // Helper to parse coordinate string: "lng,lat,alt lng,lat,alt" or "lng,lat lng,lat"
  const parseCoordinates = (coordStr: string): number[][] => {
    return coordStr
      .trim()
      .split(/\s+/)
      .filter(c => c.length > 0)
      .map(c => {
        const parts = c.split(',');
        const lng = parseFloat(parts[0]);
        const lat = parseFloat(parts[1]);
        return [lng, lat];
      })
      .filter(([lng, lat]) => !isNaN(lng) && !isNaN(lat));
  };

  placemarks.forEach((placemark) => {
    const name = placemark.querySelector('name')?.textContent?.trim() || 'Đối tượng KML';
    const description = placemark.querySelector('description')?.textContent?.trim() || '';
    
    // Default properties
    const properties: any = {
      name,
      notes: description,
      officer: 'Nhập khẩu KML',
      status: 'active',
      area: 0,
      population: 0,
      households: 0
    };

    // Extract ExtendedData if present
    const extendedData = placemark.querySelector('ExtendedData');
    if (extendedData) {
      const dataNodes = extendedData.querySelectorAll('Data, SimpleData');
      dataNodes.forEach((node) => {
        const nameAttr = node.getAttribute('name');
        const val = node.textContent?.trim();
        if (nameAttr && val) {
          properties[nameAttr] = isNaN(Number(val)) ? val : Number(val);
        }
      });
    }

    // Parse Polygons
    const polygons = placemark.querySelectorAll('Polygon');
    polygons.forEach((poly) => {
      const coordinatesList: number[][][] = [];
      
      // Outer boundary
      const outerBoundary = poly.querySelector('outerBoundaryIs LinearRing coordinates');
      if (outerBoundary && outerBoundary.textContent) {
        const coords = parseCoordinates(outerBoundary.textContent);
        if (coords.length > 0) {
          coordinatesList.push(coords);
        }
      }

      // Inner boundaries (holes)
      const innerBoundaries = poly.querySelectorAll('innerBoundaryIs LinearRing coordinates');
      innerBoundaries.forEach((inner) => {
        if (inner.textContent) {
          const coords = parseCoordinates(inner.textContent);
          if (coords.length > 0) {
            coordinatesList.push(coords);
          }
        }
      });

      if (coordinatesList.length > 0) {
        const sanitizedGeo = sanitizeGeoJSONGeometry({
          type: 'Polygon',
          coordinates: coordinatesList
        });
        if (!sanitizedGeo) return;

        const feature = {
          type: 'Feature' as const,
          properties: { ...properties },
          geometry: sanitizedGeo
        };

        // Calculate area in Hectares using turf
        try {
          const areaSqMeters = turf.area(feature);
          feature.properties.area = parseFloat((areaSqMeters / 10000).toFixed(4));
        } catch (e) {
          console.warn('Cannot calculate area for polygon:', e);
        }

        features.push(feature);
      }
    });

    // Parse Points (POIs)
    const points = placemark.querySelectorAll('Point');
    points.forEach((point) => {
      const coordEl = point.querySelector('coordinates');
      if (coordEl && coordEl.textContent) {
        const coords = parseCoordinates(coordEl.textContent);
        if (coords.length > 0) {
          features.push({
            type: 'Feature' as const,
            properties: { ...properties },
            geometry: {
              type: 'Point' as const,
              coordinates: coords[0]
            }
          });
        }
      }
    });

    // Parse LineStrings (convert closed loops to Polygon zones)
    const lineStrings = placemark.querySelectorAll('LineString');
    lineStrings.forEach((line) => {
      const coordEl = line.querySelector('coordinates');
      if (coordEl && coordEl.textContent) {
        const coords = parseCoordinates(coordEl.textContent);
        if (coords.length >= 3) {
          const first = coords[0];
          const last = coords[coords.length - 1];
          // If first and last point are close (< 0.02 deg ~ 2km), treat as closed polygon loop
          const isClosedLoop = Math.abs(first[0] - last[0]) < 0.02 && Math.abs(first[1] - last[1]) < 0.02;

          if (isClosedLoop) {
            const sanitizedGeo = sanitizeGeoJSONGeometry({
              type: 'Polygon',
              coordinates: [coords]
            });
            if (sanitizedGeo) {
              const feature = {
                type: 'Feature' as const,
                properties: { ...properties },
                geometry: sanitizedGeo
              };
              try {
                const areaSqMeters = turf.area(feature);
                feature.properties.area = parseFloat((areaSqMeters / 10000).toFixed(4));
              } catch (e) {}
              features.push(feature);
              return;
            }
          }
        }

        if (coords.length > 0) {
          features.push({
            type: 'Feature' as const,
            properties: { ...properties },
            geometry: {
              type: 'LineString' as const,
              coordinates: coords
            }
          });
        }
      }
    });
  });

  return features;
}

export function mergeFeaturesByName(features: any[]): any[] {
  const merged: any[] = [];
  
  // Group by name
  const groups: { [key: string]: any[] } = {};
  features.forEach(f => {
    const name = f.properties?.name?.trim() || 'Không tên';
    const key = name.toLowerCase();
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(f);
  });

  for (const key in groups) {
    const list = groups[key];
    if (list.length === 1) {
      merged.push(list[0]);
      continue;
    }

    // Separate Polygons/MultiPolygons, Points, and other geometries
    const polygonFeatures = list.filter(f => f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon');
    const otherFeatures = list.filter(f => f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon');

    // Add other geometries directly
    merged.push(...otherFeatures);

    if (polygonFeatures.length === 0) continue;

    if (polygonFeatures.length === 1) {
      merged.push(polygonFeatures[0]);
      continue;
    }

    // Merge polygons using turf.union
    try {
      let unionFeature = polygonFeatures[0];
      
      // Sum numeric properties
      let totalArea = polygonFeatures[0].properties?.area || 0;
      let totalPopulation = polygonFeatures[0].properties?.population || 0;
      let totalHouseholds = polygonFeatures[0].properties?.households || 0;
      let combinedNotes = polygonFeatures[0].properties?.notes || '';
      
      for (let i = 1; i < polygonFeatures.length; i++) {
        const nextFeat = polygonFeatures[i];
        
        // Sum properties
        totalArea += nextFeat.properties?.area || 0;
        totalPopulation += nextFeat.properties?.population || 0;
        totalHouseholds += nextFeat.properties?.households || 0;
        if (nextFeat.properties?.notes) {
          combinedNotes = combinedNotes 
            ? `${combinedNotes}\n${nextFeat.properties.notes}`
            : nextFeat.properties.notes;
        }

        const nextUnion = turf.union(unionFeature, nextFeat);
        if (nextUnion) {
          unionFeature = nextUnion;
        }
      }

      // Re-assign combined properties to the merged polygon feature
      unionFeature.properties = {
        ...polygonFeatures[0].properties,
        area: parseFloat(totalArea.toFixed(4)),
        population: totalPopulation,
        households: totalHouseholds,
        notes: combinedNotes
      };

      // Recalculate area with turf just to be accurate based on the union geometry
      try {
        const areaSqMeters = turf.area(unionFeature);
        unionFeature.properties.area = parseFloat((areaSqMeters / 10000).toFixed(4));
      } catch (e) {
        console.warn('Error recalculating area of union:', e);
      }

      merged.push(unionFeature);
    } catch (err) {
      console.error('Failed to merge polygons for group:', key, err);
      // Fallback: if merging fails, push them as separate features so we don't lose data
      merged.push(...polygonFeatures);
    }
  }

  return merged;
}

export async function parseKMZToGeoJSON(kmzBuffer: ArrayBuffer): Promise<any[]> {
  const zip = await JSZip.loadAsync(kmzBuffer);
  let kmlFile: JSZip.JSZipObject | null = null;

  zip.forEach((relativePath, file) => {
    if (!file.dir && relativePath.toLowerCase().endsWith('.kml')) {
      kmlFile = file;
    }
  });

  if (!kmlFile) {
    throw new Error('Không tìm thấy tệp .kml bên trong tệp KMZ.');
  }

  const kmlText = await (kmlFile as JSZip.JSZipObject).async('text');
  return parseKMLToGeoJSON(kmlText);
}


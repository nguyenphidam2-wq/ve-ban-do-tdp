// @ts-ignore
import * as turf from '@turf/turf';


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
        const feature = {
          type: 'Feature' as const,
          properties: { ...properties },
          geometry: {
            type: 'Polygon' as const,
            coordinates: coordinatesList
          }
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

    // Parse LineStrings
    const lineStrings = placemark.querySelectorAll('LineString');
    lineStrings.forEach((line) => {
      const coordEl = line.querySelector('coordinates');
      if (coordEl && coordEl.textContent) {
        const coords = parseCoordinates(coordEl.textContent);
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

import type { Coordinates } from '../types';

/**
 * Parse WKT POINT string to coordinates object
 * @param wktGeom WKT POINT string like "POINT(4.88134747873096 52.3638068249909)"
 * @returns Coordinates object with lon and lat properties
 * @throws Error if the WKT string cannot be parsed or contains invalid coordinates
 */
export function parseWKTPoint(wktGeom: string): Coordinates {
  // Example: "POINT(4.88134747873096 52.3638068249909)"
  const match = wktGeom.match(/POINT\(([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\)/);
  
  if (!match) {
    throw new Error(`Cannot parse WKT geometry: ${wktGeom}`);
  }
  
  const lon = parseFloat(match[1]);
  const lat = parseFloat(match[2]);
  
  if (isNaN(lon) || isNaN(lat)) {
    throw new Error(`Invalid coordinates in WKT: ${wktGeom}`);
  }
  
  return { lon, lat };
}
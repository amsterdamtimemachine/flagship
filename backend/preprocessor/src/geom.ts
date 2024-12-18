import { 
   type Point2D, 
} from '@atm/shared-types';

export type Coordinate = [number, number];

export function coordsMetersToLatLon(coordinate: Coordinate): Coordinate {
   const halfEarthCircumference = 20037508.34; 
   const [x, y] = coordinate;
   const lon = (x / halfEarthCircumference) * 180;
   let lat = (y / halfEarthCircumference) * 180;
   lat = (Math.atan(Math.exp(lat * Math.PI / 180)) * 360 / Math.PI) - 90;
   return [lon, lat];
}

export function calculateCentroid(coordinates: Coordinate[]): Point2D {
   const sum = coordinates.reduce(
       (acc, [x, y]) => ({
           x: acc.x + x,
           y: acc.y + y
       }),
       { x: 0, y: 0 }
   );
   
   return {
       x: sum.x / coordinates.length,
       y: sum.y / coordinates.length
   };
}

export function calculateMultiLineCentroid(coordinates: Coordinate[][]): Point2D {
   const allPoints = coordinates.flat();
   return calculateCentroid(allPoints);
}

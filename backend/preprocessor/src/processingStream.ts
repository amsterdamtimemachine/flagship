import { readdir, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { join } from 'node:path';
import { 
   Point2D, 
   PointFeature,
   MultiLineStringFeature,
   LineStringFeature,
   PolygonFeature,
   GeoFeature,
   Grid,
   GridConfig
} from '@atm/shared-types';

interface ExtractFeaturesOptions {
   dropNulls: boolean;
   convertMetersToLatLon: boolean;
}

function coordsMetersToLatLon(x: number, y: number): [number, number] {
   const halfEarthCircumference = 20037508.34; 
   const lon = (x / halfEarthCircumference) * 180;
   let lat = (y / halfEarthCircumference) * 180;
   lat = (Math.atan(Math.exp(lat * Math.PI / 180)) * 360 / Math.PI) - 90;
   return [lon, lat];
}

function calculateCentroid(coordinates: [number, number][]): Point2D {
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

function calculateMultiLineCentroid(coordinates: [number, number][][]): Point2D {
   const allPoints = coordinates.flat();
   return calculateCentroid(allPoints);
}

type Coordinate = [number, number];
function processFeature(feature: any, options: ExtractFeaturesOptions): GeoFeature | null { 
        switch (feature.geometry.type) {
               case "Point": {
                   const [x, y] = feature.geometry.coordinates;
                   if (options.dropNulls && (isNaN(x) || isNaN(y))) return null;
                   
                   const coordinates = options.convertMetersToLatLon 
                       ? coordsMetersToLatLon(x, y)
                       : [x, y];

                   return {
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates
                       }
                   } as PointFeature;
               }
                   
               case "MultiLineString": {
                   const validCoordinates = feature.geometry.coordinates
                       .map((line: Coordinate[]) => 
                           line.filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)))
                       ).filter((line: Coordinate[]) => line.length > 0);
                   
                   if (options.dropNulls && validCoordinates.length === 0) return null;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map((line: Coordinate []) => 
                           line.map(([x, y]) => coordsMetersToLatLon(x, y))
                         )
                       : validCoordinates;
                   
                  return {
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
                           centroid: calculateMultiLineCentroid(convertedCoordinates)
                       }
                   } as MultiLineStringFeature;
               }
               
               case "LineString": {
                   const validCoordinates = feature.geometry.coordinates
                       .filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)));
                   
                   if (options.dropNulls && validCoordinates.length === 0) return null;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map(([x, y]) => coordsMetersToLatLon(x, y))
                       : validCoordinates;
                   
                   return {
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
                           centroid: calculateCentroid(convertedCoordinates)
                       }
                   } as LineStringFeature;
               }
               
               case "Polygon": {
                   const validCoordinates = feature.geometry.coordinates
                       .map((ring: Coordinate[]) => 
                           ring.filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)))
                       ).filter((ring: Coordinate[]) => ring.length > 0);
                   
                   if (options.dropNulls && validCoordinates.length === 0) return null;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map((ring: Coordinate[]) => 
                           ring.map(([x, y]) => coordsMetersToLatLon(x, y))
                         )
                       : validCoordinates;
                   
                   const coordinates2D = convertedCoordinates[0];
                   
                   return {
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
                           centroid: calculateCentroid(coordinates2D)
                       }
                   } as PolygonFeature;
               }
           }
           return null;
}


async function processGeoJsonStream(
   folderPath: string,
   options: ExtractFeaturesOptions,
   onFeatureProcessed: (feature: GeoFeature) => void
) {
   const files = await readdir(folderPath);
   const geoJsonFiles = files.filter(f => f.endsWith('.geojson'));
   
   for (const file of geoJsonFiles) {
       const fileStream = Bun.file(join(folderPath, file)).stream();
       const data = await Bun.readableStreamToJSON(fileStream);
       
       for (const feature of data.features) {
           switch (feature.geometry.type) {
               case "Point": {
                   const [x, y] = feature.geometry.coordinates;
                   if (options.dropNulls && (isNaN(x) || isNaN(y))) continue;
                   
                   const coordinates = options.convertMetersToLatLon 
                       ? coordsMetersToLatLon(x, y)
                       : [x, y];

                   onFeatureProcessed({
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates
                       }
                   } as PointFeature);
                   break;
               }
                   
               case "MultiLineString": {
                   const validCoordinates = feature.geometry.coordinates
                       .map((line: [number, number][]) => 
                           line.filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)))
                       ).filter((line: [number, number][]) => line.length > 0);
                   
                   if (options.dropNulls && validCoordinates.length === 0) continue;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map(line => 
                           line.map(([x, y]) => coordsMetersToLatLon(x, y))
                         )
                       : validCoordinates;
                   
                   onFeatureProcessed({
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
                           centroid: calculateMultiLineCentroid(convertedCoordinates)
                       }
                   } as MultiLineStringFeature);
                   break;
               }
               
               case "LineString": {
                   const validCoordinates = feature.geometry.coordinates
                       .filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)));
                   
                   if (options.dropNulls && validCoordinates.length === 0) continue;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map(([x, y]) => coordsMetersToLatLon(x, y))
                       : validCoordinates;
                   
                   onFeatureProcessed({
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
                           centroid: calculateCentroid(convertedCoordinates)
                       }
                   } as LineStringFeature);
                   break;
               }
               
               case "Polygon": {
                   const validCoordinates = feature.geometry.coordinates
                       .map((ring: [number, number][]) => 
                           ring.filter(([x, y]) => !options.dropNulls || (!isNaN(x) && !isNaN(y)))
                       ).filter((ring: [number, number][]) => ring.length > 0);
                   
                   if (options.dropNulls && validCoordinates.length === 0) continue;

                   const convertedCoordinates = options.convertMetersToLatLon
                       ? validCoordinates.map(ring => 
                           ring.map(([x, y]) => coordsMetersToLatLon(x, y))
                         )
                       : validCoordinates;
                   
                   const coordinates2D = convertedCoordinates[0];
                   
                   onFeatureProcessed({
                       ...feature,
                       geometry: {
                           ...feature.geometry,
                           coordinates: convertedCoordinates,
                           centroid: calculateCentroid(coordinates2D)
                       }
                   } as PolygonFeature);
                   break;
               }
           }
       }
   }
}



async function saveProcessedFeaturesToIntermediary(
  folderPath: string,
  intermediaryPath: string,
  options: ExtractFeaturesOptions
) {
  // Ensure directory exists
  const dir = dirname(intermediaryPath);
  await mkdir(dir, { recursive: true });
  
  const writeStream = Bun.file(intermediaryPath).writer();
  
  try {
      await processGeoJsonStream(
          folderPath,
          options,
          (feature: GeoFeature) => {
              writeStream.write(JSON.stringify(feature) + '\n');
          }
      );
  } catch (error) {
      console.error('Error during processing:', error);
      throw error;
  } finally {
      await writeStream.end();
  }
}// Usage:

import JSONStream from 'jsonstream';
import { createReadStream } from 'node:fs';

async function saveProcessedFeaturesToIntermediary2(
   folderPath: string,
   intermediaryPath: string,
   options: ExtractFeaturesOptions
) {
   const dir = dirname(intermediaryPath);
   await mkdir(dir, { recursive: true });
   
   const writer = Bun.file(intermediaryPath).writer();
   
   try {
       const files = await readdir(folderPath);
       const geoJsonFiles = files.filter(f => f.endsWith('.geojson'));

       for (const file of geoJsonFiles) {
           const readStream = createReadStream(join(folderPath, file));
           const parser = JSONStream.parse('features.*');
           
           await new Promise((resolve, reject) => {
               readStream
                   .pipe(parser)
                   .on('data', (feature: any) => {
                       // Process each feature
                       const processed = processFeature(feature, options);
                       if (processed) {
                           writer.write(JSON.stringify(processed) + '\n');
                       }
                   })
                   .on('error', reject)
                   .on('end', resolve);
           });
       }
   } catch (error) {
       console.error('Error during processing:', error);
       throw error;
   } finally {
       writer.end();
   }
}
export {
   saveProcessedFeaturesToIntermediary,
    saveProcessedFeaturesToIntermediary2,
   type ExtractFeaturesOptions
};

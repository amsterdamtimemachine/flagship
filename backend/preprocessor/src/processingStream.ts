import { readdir, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';
import JSONStream from 'jsonstream';

import { 
   Point2D, 
   PointFeature,
   MultiLineStringFeature,
   LineStringFeature,
   PolygonFeature,
   GeoFeature,
   Grid,
   GridConfig,
   GridDimensions
} from '@atm/shared-types';


import {
    getCellIdForPoint
} from './processing';


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





async function saveProcessedFeaturesToIntermediary(
   folderPath: string,
   intermediaryPath: string,
   options: ExtractFeaturesOptions
) {
   const dir = dirname(intermediaryPath);
   await mkdir(dir, { recursive: true });
   
   const writer = Bun.file(intermediaryPath).writer();
   
   try {
       // Start array
       writer.write('[\n');
       let isFirst = true;

       const files = await readdir(folderPath);
       const geoJsonFiles = files.filter(f => f.endsWith('.geojson'));

       for (const file of geoJsonFiles) {
           const readStream = createReadStream(join(folderPath, file));
           const parser = JSONStream.parse('features.*');
           
           await new Promise((resolve, reject) => {
               readStream
                   .pipe(parser)
                   .on('data', (feature: any) => {
                       const processed = processFeature(feature, options);
                       if (processed) {
                           // Add comma between features, but not before first one
                           if (!isFirst) {
                               writer.write(',\n');
                           }
                           isFirst = false;
                           writer.write(JSON.stringify(processed));
                       }
                   })
                   .on('error', reject)
                   .on('end', resolve);
           });
       }
       
       // Close array
       writer.write('\n]');
   } catch (error) {
       console.error('Error during processing:', error);
       throw error;
   } finally {
       writer.end();
   }
}

interface FirstPassResult {
    cellCounts: Map<string, number>;
    entityGridIndices: Map<string, string>; 
}

async function firstPassGridProcessing(
    ndjsonPath: string,
    gridDimensions: GridDimensions
): Promise<FirstPassResult> {
    const cellCounts = new Map<string, number>();
    const entityGridIndices = new Map<string, string>();
    
    const readStream = createReadStream(ndjsonPath);
    const parser = JSONStream.parse('*');
    
    await new Promise((resolve, reject) => {
        readStream
            .pipe(parser)
            .on('data', (feature: GeoFeature) => {
                let point: Point2D | undefined;
                if (feature.geometry.type === "Point") {
                    point = {
                        x: feature.geometry.coordinates[0],
                        y: feature.geometry.coordinates[1]
                    };
                } else {
                    point = feature.geometry.centroid;
                }

                if (!point) return;
                
                const cellId = getCellIdForPoint(point, gridDimensions, );
                if (!cellId) return;

                // Store cell mapping
                entityGridIndices.set(feature.properties.url, cellId);
                
                // Update count
                cellCounts.set(
                    cellId, 
                    (cellCounts.get(cellId) || 0) + 1
                );
            })
            .on('error', reject)
            .on('end', resolve);
    });

    return {
        cellCounts,
        entityGridIndices
    };
}

interface BinaryWriteOptions {
    headerSize: number;
    gridDimensions: GridDimensions;
}

async function secondPassWriteBinary(
   ndjsonPath: string,
   outputPath: string,
   firstPassResult: FirstPassResult,
   options: BinaryWriteOptions
) {
   const writer = Bun.file(outputPath).writer();
   
   // Write grid metadata first
   const gridMetadata = {
       cellCounts: Array.from(firstPassResult.cellCounts.entries()),
       entityGridIndices: Array.from(firstPassResult.entityGridIndices.entries()),
       dimensions: options.gridDimensions,
       header: {
           gridDataSize: 0,  // We'll calculate this in a moment
           totalFeatures: firstPassResult.cellCounts.size
       }
   };
   
   // Calculate and set grid data size
   const gridMetadataString = JSON.stringify(gridMetadata);
   gridMetadata.header.gridDataSize = new TextEncoder().encode(gridMetadataString).length;

   // Write the final metadata with correct size
   const finalMetadataBytes = new TextEncoder().encode(JSON.stringify(gridMetadata));
   writer.write(finalMetadataBytes);

   // Write features
   const readStream = createReadStream(ndjsonPath);
   const parser = JSONStream.parse('*');
   
   await new Promise((resolve, reject) => {
       readStream
           .pipe(parser)
           .on('data', (feature: GeoFeature) => {
               writer.write(JSON.stringify(feature) + '\n');
           })
           .on('error', reject)
           .on('end', resolve);
   });

   await writer.end();
}


async function processToBinaryGrid(
    ndjsonPath: string,
    outputPath: string,
    gridDimensions: GridDimensions
) {
    // First pass: get grid structure
    console.log('Starting first pass...');
    const firstPassResult = await firstPassGridProcessing(
        ndjsonPath, 
        gridDimensions,
    );
    
    // Calculate dimensions once

    // Second pass: write binary with grid structure
    console.log('Starting second pass...');
    await secondPassWriteBinary(
        ndjsonPath,
        outputPath,
        firstPassResult,
        {
            headerSize: 64,
            gridDimensions,
        }
    );
    console.log('Processing complete');
}


export {
   saveProcessedFeaturesToIntermediary,
   processToBinaryGrid,
   type ExtractFeaturesOptions
};

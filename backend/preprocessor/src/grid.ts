import { readdir, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';
import JSONStream from 'jsonstream';
import { encode, decode } from '@msgpack/msgpack';

import type { 
   Point2D, 
   PointFeature,
   MultiLineStringFeature,
   LineStringFeature,
   PolygonFeature,
   GeoFeature,
   GridConfig,
   GridDimensions
} from '@atm/shared-types';

import { 
    type Coordinate,
    coordsMetersToLatLon, 
    calculateCentroid, 
    calculateMultiLineCentroid,
} from './geom';

type GeoJsonProcessingOptions = {
       dropNulls: boolean;
       convertMetersToLatLon: boolean;
}

function getGridDimensionsFromConfig(config: GridConfig): GridDimensions {
    const minLon = Math.min(config.boundA[0], config.boundB[0]);
    const maxLon = Math.max(config.boundA[0], config.boundB[0]);
    const minLat = Math.min(config.boundA[1], config.boundB[1]);
    const maxLat = Math.max(config.boundA[1], config.boundB[1]);
    
    const latSpan = Math.abs(config.boundA[1] - config.boundB[1]);
    const lonSpan = Math.abs(config.boundA[0] - config.boundB[0]);
    
    return {
        colsAmount: config.colsAmount,
        rowsAmount: config.rowsAmount,
        cellWidth: lonSpan / config.colsAmount,
        cellHeight: latSpan / config.rowsAmount,
        minLon,
        maxLon,
        minLat,
        maxLat
    };
};

function validateFeature(feature: any) {
    const required = ['type', 'properties', 'geometry'];
    const props = ['url', 'title', 'start_date', 'end_date'];
    
    if (!required.every(key => key in feature)) {
        throw new Error(`Missing required field: ${required.filter(k => !(k in feature)).join(', ')}`);
    }
    
    if (!props.every(key => key in feature.properties)) {
        throw new Error(`Missing property: ${props.filter(k => !(k in feature.properties)).join(', ')}`);
    }
    
    // Test stringification
    const serialized = JSON.stringify(feature);
    try {
        JSON.parse(serialized);
    } catch (e) {
        throw new Error(`Feature cannot be serialized: ${e}`);
    }
    
    return true;
}

async function processGeoJsonFolderToFeatures(
    geoJsonFeaturesFolderPath: string,
    processedJsonPath: string,
    options: GeoJsonProcessingOptions
) {
    const writer = Bun.file(processedJsonPath).writer();
    writer.write('[\n');
    let isFirst = true;
    let featureCount = 0;
    
    try {
        const files = await readdir(geoJsonFeaturesFolderPath);
        const geoJsonFiles = files.filter(f => f.endsWith('.geojson'));
        
        for (const file of geoJsonFiles) {
            const filePath = join(geoJsonFeaturesFolderPath, file);
            console.log(`Processing ${file}...`);
            
            const jsonReadStream = createReadStream(filePath);
            const jsonParser = JSONStream.parse('features.*');
            
            try {
                await new Promise((resolve, reject) => {
                    jsonReadStream
                        .pipe(jsonParser)
                        .on('data', (feature: any) => {
                            try {
                                const processed = processFeature(feature, options);
                                if (processed && validateFeature(processed)) {
                                    if (!isFirst) writer.write(',\n');
                                    writer.write(JSON.stringify(processed));
                                    isFirst = false;
                                    featureCount++;
                                }
                            } catch (err) {
                                console.error(`Error processing feature ${featureCount} in ${file}:`, err);
                                console.error('Problematic feature:', JSON.stringify(feature, null, 2));
                            }
                        })
                        .on('error', (err) => {
                            console.error(`Error parsing ${file}:`, err);
                            reject(err);
                        })
                        .on('end', resolve);
                });
            } catch (err) {
                console.error(`Failed to process ${file}:`, err);
            }
        }
        
        writer.write('\n]');
        console.log(`Processed ${featureCount} features`);
    } finally {
        await writer.end();
    }
}

const getCellIdForPoint = (
    point: Point2D,
    gridDimensions: GridDimensions,
): string | null => {
    /* 
    * find the cell where a point belongs to in the grid 
    */
    const col = Math.floor((point.x - gridDimensions.minLon) / gridDimensions.cellWidth);
    const row = Math.floor((point.y - gridDimensions.minLat) / gridDimensions.cellHeight);

    if (row >= 0 && row < gridDimensions.rowsAmount && col >= 0 && col < gridDimensions.colsAmount) {
        return `${row}_${col}`;
    }
    return null;
};

function processFeature(feature: any, options: GeoJsonProcessingOptions): GeoFeature | null { 
    /**
    * Processes a GeoJSON feature by validating coordinates, optionally converting from meters to lat/lon,
    * and computing centroids for non-point geometries.
    * 
    * @param feature - Raw GeoJSON feature with geometry type of Point, MultiLineString, LineString, or Polygon
    * @param options - Processing options:
    *   - dropNulls: If true, filters out invalid/NaN coordinates
    *   - convertMetersToLatLon: If true, converts meters to lat/lon coordinates
    * 
    * @returns Processed GeoFeature:
    * 
    * Handles different geometry types:
    * - Point: Simple coordinate validation/conversion
    * - MultiLineString: Processes multiple line arrays, computes centroid from all points
    * - LineString: Processes single line array, computes centroid
    * - Polygon: Processes ring arrays, computes centroid from outer ring
    */
        switch (feature.geometry.type) {
               case "Point": {
                   const [x, y] = feature.geometry.coordinates;
                   if (options.dropNulls && (isNaN(x) || isNaN(y))) return null;
                   
                   const coordinates = options.convertMetersToLatLon 
                       ? coordsMetersToLatLon([x, y])
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
                           line.map((coordinate2D) => coordsMetersToLatLon(coordinate2D))
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
                       ? validCoordinates.map((coordinate2D) => coordsMetersToLatLon(coordinate2D))
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
                           ring.map((coordinate2D) => coordsMetersToLatLon(coordinate2D))
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

async function processFeaturesToGrid(
    /**
    * Main function for creating the final binary grid file.
    * Process:
    * 1. First pass: Create grid structure and indices
    * 2. Second pass: Write binary file with metadata and features

    * @param processedJsonPath - Path to processed JSON from processGeoJsonFolderToFeatures
    * @param outputBinaryPath - Path for final binary output
    * @param gridDimensions - Grid configuration
    */
    processedJsonPath: string,
    outputBinaryPath: string,
    gridDimensions: GridDimensions
) {
    const firstPassResult = await firstPassProcessJsonFeaturesToGrid(
        processedJsonPath, 
        gridDimensions,
    );

   // await createMinimalBinary(
   //     processedJsonPath,
   //     outputBinaryPath,
   //     gridDimensions,
   // );

    
   // await secondPassProcessJsonFeaturesToGrid(
   //     processedJsonPath,
   //     outputBinaryPath,
   //     firstPassResult,
   //     { gridDimensions },
   // );


    await secondPassProcessJsonFeaturesToGridStream(
        processedJsonPath,
        outputBinaryPath,
        firstPassResult,
        { gridDimensions },
    );
}

interface FirstPassResult {
   /** Map of cellId to number of features in that cell */
   cellCounts: Map<string, number>;
   /** Map of feature URL to its containing cellId */
   entityGridIndices: Map<string, string>; 
}

async function firstPassProcessJsonFeaturesToGrid(
    processedJsonPath: string,
    gridDimensions: GridDimensions
): Promise<FirstPassResult> {
    const cellCounts = new Map<string, number>();
    const entityGridIndices = new Map<string, string>();
    
    // Initialize all possible grid cells with zero counts
    for (let row = 0; row < gridDimensions.rowsAmount; row++) {
        for (let col = 0; col < gridDimensions.colsAmount; col++) {
            cellCounts.set(`${row}_${col}`, 0);
        }
    }
    
    const jsonReadStream = createReadStream(processedJsonPath);
    const jsonParser = JSONStream.parse('*');
    try {
        await new Promise((resolve, reject) => {
            jsonReadStream
                .pipe(jsonParser)
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
                    
                    const cellId = getCellIdForPoint(point, gridDimensions);
                    if (!cellId) return;

                    // Store cell mapping
                    entityGridIndices.set(feature.properties.url, cellId);
                    
                    // Update count (cell already initialized with 0)
                    cellCounts.set(
                        cellId, 
                        (cellCounts.get(cellId) || 0) + 1
                    );
                })
                .on('error', reject)
                .on('end', resolve);
        });
    } finally {
        jsonParser.end();
    }

    return {
        cellCounts,
        entityGridIndices
    };
}



import * as fs from 'node:fs/promises';

interface Feature {
    type: string;
    properties: {
        url: string;
        title: string;
        start_date: string;
        end_date: string;
        thumb: string;
    };
    geometry: {
        type: string;
        coordinates: number[][][] | number[][];
        centroid?: { x: number; y: number };
    };
}

interface BinaryCellIndex {
    startOffset: number;
    endOffset: number;
    featureCount: number;
}

interface BinaryMetadata {
    version: number;
    dimensions: GridDimensions;
    cellIndices: Record<string, BinaryCellIndex>;
}

async function secondPassProcessJsonFeaturesToGrid(
  processedJsonPath: string,
  binaryPath: string,
  firstPassResult: { cellCounts: Map<string, number>, entityGridIndices: Map<string, string> },
  options: { gridDimensions: GridDimensions }
) {
      try {
        const data = await fs.readFile(processedJsonPath, 'utf8');
        const features: Feature[] = JSON.parse(data) as Feature[];

        const cellData: Record<string, Feature[]> = {};
        for (const feature of features) {
          const cellId = firstPassResult.entityGridIndices.get(feature.properties.url);
          if (cellId) {
            cellData[cellId] = cellData[cellId] || [];
            cellData[cellId].push(feature);
          }
        }

        const cellIndices: Record<string, { startOffset: number; endOffset: number; featureCount: number }> = {};
        let dataOffset = 0;

        for (const cellId in cellData) {
          const encoded = encode(cellData[cellId]);
          cellIndices[cellId] = {
            startOffset: dataOffset,
            endOffset: dataOffset + encoded.byteLength,
            featureCount: cellData[cellId].length,
          };
          dataOffset += encoded.byteLength;
        }

        const metadata: BinaryMetadata = {
          version: 1,
          dimensions: options.gridDimensions,
          cellIndices,
        };

        const writer = Bun.file(binaryPath).writer();
        const metadataBytes = encode(metadata);
        const metadataSize = metadataBytes.byteLength;

        const sizeBuffer = Buffer.allocUnsafe(4);
        sizeBuffer.writeUInt32BE(metadataSize, 0);
        writer.write(sizeBuffer);
        writer.write(metadataBytes);

        for (const cellId in cellData) {
            writer.write(encode(cellData[cellId]));
        }

        await writer.end();
        console.log("Binary file written successfully!");

    } catch (error) {
        console.error("Error processing or writing binary file:", error);
    }
}


async function secondPassProcessJsonFeaturesToGridStream(
 processedJsonPath: string, 
 binaryPath: string,
 firstPassResult: { cellCounts: Map<string, number>, entityGridIndices: Map<string, string> },
 options: { gridDimensions: GridDimensions }
) {
 try {
   // First pass: Calculate encoded sizes per cell
   const cellSizes = new Map<string, number>();
   const firstStream = createReadStream(processedJsonPath);
   const firstParser = JSONStream.parse('*');

   await new Promise((resolve, reject) => {
     const tempFeatures: Record<string, Feature[]> = {};
     firstStream
       .pipe(firstParser)
       .on('data', (feature: Feature) => {
         const cellId = firstPassResult.entityGridIndices.get(feature.properties.url);
         if (!cellId) return;

         if (!tempFeatures[cellId]) tempFeatures[cellId] = [];
         tempFeatures[cellId].push(feature);

         // Encode and measure when we hit batch size or end of cell
         if (tempFeatures[cellId].length >= 1000 || 
             tempFeatures[cellId].length === firstPassResult.cellCounts.get(cellId)) {
           const encoded = encode(tempFeatures[cellId]);
           cellSizes.set(cellId, (cellSizes.get(cellId) || 0) + encoded.byteLength);
           tempFeatures[cellId] = []; // Clear batch
         }
       })
       .on('error', reject)
       .on('end', () => {
         // Encode any remaining features
         for (const [cellId, features] of Object.entries(tempFeatures)) {
           if (features.length > 0) {
             const encoded = encode(features);
             cellSizes.set(cellId, (cellSizes.get(cellId) || 0) + encoded.byteLength);
           }
         }
         resolve(undefined);
       });
   });

   // Calculate offsets
   const cellIndices: Record<string, BinaryCellIndex> = {};
   let dataOffset = 0;
   
   for (const [cellId, size] of cellSizes) {
     cellIndices[cellId] = {
       startOffset: dataOffset,
       endOffset: dataOffset + size,
       featureCount: firstPassResult.cellCounts.get(cellId) || 0
     };
     dataOffset += size;
   }

   // Write metadata
   const metadata: BinaryMetadata = {
     version: 1,
     dimensions: options.gridDimensions,
     cellIndices
   };

   const writer = Bun.file(binaryPath).writer();
    const metadataBytes = encode(metadata);
    const metadataSize = metadataBytes.byteLength;

    const sizeBuffer = Buffer.allocUnsafe(4);
    sizeBuffer.writeUInt32BE(metadataSize, 0);
    writer.write(sizeBuffer);
    writer.write(metadataBytes);
   await writer.flush();

   // Second pass: Write features
   const tempFeatures: Record<string, Feature[]> = {};
   const secondStream = createReadStream(processedJsonPath);
   const secondParser = JSONStream.parse('*');

   await new Promise((resolve, reject) => {
     secondStream
       .pipe(secondParser)
       .on('data', (feature: Feature) => {
         const cellId = firstPassResult.entityGridIndices.get(feature.properties.url);
         if (!cellId) return;

         if (!tempFeatures[cellId]) tempFeatures[cellId] = [];
         tempFeatures[cellId].push(feature);

         // Write batch when full or end of cell
         if (tempFeatures[cellId].length >= 1000 || 
             tempFeatures[cellId].length === firstPassResult.cellCounts.get(cellId)) {
           writer.write(encode(tempFeatures[cellId]));
           writer.flush();
           tempFeatures[cellId] = []; // Clear batch
         }
       })
       .on('error', reject)
       .on('end', async () => {
         // Write any remaining features
         for (const features of Object.values(tempFeatures)) {
           if (features.length > 0) {
             writer.write(encode(features));
             await writer.flush();
           }
         }
         resolve(undefined);
       });
   });

   await writer.end();
   console.log("Binary file written successfully!");
 } catch (error) {
   console.error("Error processing or writing binary file:", error);
 }
}

type Metadata = {
    version: number;
    dimensions: GridDimensions;
    featureOffsets: { start: number; end: number }[];
};

async function createMinimalBinary(
    processedJsonPath: string,
    binaryPath: string,
    gridDimensions: GridDimensions
) {
    try {
        const data = await fs.readFile(processedJsonPath, 'utf8');
        const features: Feature[] = JSON.parse(data) as Feature[];

        if (features.length === 0) {
            console.error("No features provided.");
            return;
        }

        const encodedFeatures: Uint8Array[] = features.map(encode);
        const featureOffsets: { start: number; end: number }[] = [];
        let currentOffset = 0;

        for (const encodedFeature of encodedFeatures) {
            featureOffsets.push({
                start: currentOffset,
                end: currentOffset + encodedFeature.byteLength,
            });
            currentOffset += encodedFeature.byteLength;
        }

        const metadata: Metadata = {
            version: 1,
            dimensions: gridDimensions,
            featureOffsets,
        };

        const encodedMetadata = encode(metadata);
        const metadataSize = encodedMetadata.byteLength;

        const sizeBuffer = Buffer.allocUnsafe(4);
        sizeBuffer.writeUInt32BE(metadataSize, 0);

        const writer = Bun.file(binaryPath).writer();
        writer.write(sizeBuffer);
        writer.write(encodedMetadata);

        for (const encodedFeature of encodedFeatures) {
            writer.write(encodedFeature);
        }

        await writer.end();
        console.log("Binary file created with all features successfully!");
    } catch (error) {
        console.error("Error creating binary file:", error);
    }
}
export {
   GeoJsonProcessingOptions,
   processGeoJsonFolderToFeatures,
   processFeaturesToGrid,
   getGridDimensionsFromConfig,
};

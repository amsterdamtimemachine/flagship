// WIP: This grid processor uses streaming only partially. 
// the current input geojson files are completely loaded into the ram requiring ~10gb of memory, this might become an issue on a server.

// The goal is to implement streaming throughout the whole process to avoid running into out of memory issues with large datasets.
// I removed streaming from the secondPassProcessJsonFeaturesToGrid fn since it was causing issues when deserialising the dataset on the server
// continue working on the streaming fn in the grid_stream.ts module

import { readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import JSONStream from 'jsonstream';
import { encode } from '@msgpack/msgpack';
import * as fs from 'node:fs/promises';

import type { 
   Point2D, 
   PointFeature,
   MultiLineStringFeature,
   LineStringFeature,
   PolygonFeature,
   GeoFeature,
   GridConfig,
   GridDimensions,
   GridCellBounds,
   BinaryMetadata,
   BinaryCellIndex,
   HeatmapCell,
   Heatmap,

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

async function processFeaturesToGrid(
    processedJsonPath: string,
    outputBinaryPath: string,
    gridDimensions: GridDimensions
) {
    /**
    * Main function for creating the final binary grid file.
    * Process:
    * 1. First pass: Create grid structure and indices
    * 2. Second pass: Write binary file with metadata and features

    * @param processedJsonPath - Path to processed JSON from processGeoJsonFolderToFeatures
    * @param outputBinaryPath - Path for final binary output
    * @param config - Grid configuration
    */
    const firstPassResult = await firstPassProcessJsonFeaturesToGrid(
        processedJsonPath, 
        gridDimensions,
    );
    
    await secondPassProcessJsonFeaturesToGrid(
        processedJsonPath,
        outputBinaryPath,
        firstPassResult,
        { gridDimensions },
    );
}

//function getGridDimensionsFromConfig(config: GridConfig): GridDimensions {
//    const minLon = Math.min(config.boundA[0], config.boundB[0]);
//    const maxLon = Math.max(config.boundA[0], config.boundB[0]);
//    const minLat = Math.min(config.boundA[1], config.boundB[1]);
//    const maxLat = Math.max(config.boundA[1], config.boundB[1]);
//    
//    const latSpan = Math.abs(config.boundA[1] - config.boundB[1]);
//    const lonSpan = Math.abs(config.boundA[0] - config.boundB[0]);
//    
//    return {
//        colsAmount: config.colsAmount,
//        rowsAmount: config.rowsAmount,
//        cellWidth: lonSpan / config.colsAmount,
//        cellHeight: latSpan / config.rowsAmount,
//        minLon,
//        maxLon,
//        minLat,
//        maxLat
//    };
//};

async function calculateGridDimensions(
    processedJsonPath: string,
    config: GridConfig
): Promise<GridDimensions> {
    const bounds: GridCellBounds = {
        minLon: Infinity,
        maxLon: -Infinity,
        minLat: Infinity,
        maxLat: -Infinity
    };

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

                    bounds.minLon = Math.min(bounds.minLon, point.x);
                    bounds.maxLon = Math.max(bounds.maxLon, point.x);
                    bounds.minLat = Math.min(bounds.minLat, point.y);
                    bounds.maxLat = Math.max(bounds.maxLat, point.y);
                })
                .on('error', reject)
                .on('end', resolve);
        });
    } finally {
        jsonParser.end();
    }

    // Add padding
    const lonSpan = bounds.maxLon - bounds.minLon;
    const latSpan = bounds.maxLat - bounds.minLat;
    const lonPadding = lonSpan * config.padding;
    const latPadding = latSpan * config.padding;

    const dimensions: GridDimensions = {
        colsAmount: config.colsAmount,
        rowsAmount: config.rowsAmount,
        minLon: bounds.minLon - lonPadding,
        maxLon: bounds.maxLon + lonPadding,
        minLat: bounds.minLat - latPadding,
        maxLat: bounds.maxLat + latPadding,
        cellWidth: (bounds.maxLon - bounds.minLon + 2 * lonPadding) / config.colsAmount,
        cellHeight: (bounds.maxLat - bounds.minLat + 2 * latPadding) / config.rowsAmount
    };

    return dimensions;
}

function validateFeature(feature: GeoFeature) {
    const required = ['type', 'properties', 'geometry'];
    const props = ['url', 'title', 'start_date', 'end_date'];
    
    if (!required.every(key => key in feature)) {
        throw new Error(`Missing required field: ${required.filter(k => !(k in feature)).join(', ')}`);
    }
    
    if (!props.every(key => key in feature.properties)) {
        throw new Error(`Missing property: ${props.filter(k => !(k in feature.properties)).join(', ')}`);
    }
    
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


function calculateCellBounds(row: number, col: number, gridDimensions: GridDimensions) {
    const cellWidth = +(Math.abs(gridDimensions.maxLon - gridDimensions.minLon) / gridDimensions.colsAmount).toFixed(10);
    const cellHeight = +(Math.abs(gridDimensions.maxLat - gridDimensions.minLat) / gridDimensions.rowsAmount).toFixed(10);
    
    const minLon = +(gridDimensions.minLon + (col * cellWidth)).toFixed(10);
    const maxLon = +(minLon + cellWidth).toFixed(10);
    const minLat = +(gridDimensions.minLat + (row * cellHeight)).toFixed(10);
    const maxLat = +(minLat + cellHeight).toFixed(10);

    return {
        minLon,
        maxLon,
        minLat,
        maxLat
    };
}

async function findTimeRange(processedJsonPath: string): Promise<{start: Date, end: Date}> {
    const jsonReadStream = createReadStream(processedJsonPath);
    const jsonParser = JSONStream.parse('*');
    let start: Date | null = null;
    let end: Date | null = null;
    let errorCount = 0;

    try {
        await new Promise((resolve, reject) => {
            jsonReadStream
                .pipe(jsonParser)
                .on('data', (feature: GeoFeature) => {
                    try {
                        const featureStart = new Date(feature.properties.start_date);
                        const featureEnd = new Date(feature.properties.end_date);
                        
                        if (isNaN(featureStart.getTime())) {
                            console.warn(`Invalid start_date: ${feature.properties.start_date} for feature ${feature.properties.url}`);
                            errorCount++;
                            return;
                        }

                        if (isNaN(featureEnd.getTime())) {
                            console.warn(`Invalid end_date: ${feature.properties.end_date} for feature ${feature.properties.url}`);
                            errorCount++;
                            return;
                        }

                        if (!start || featureStart < start) start = featureStart;
                        if (!end || featureEnd > end) end = featureEnd;
                    } catch (err) {
                        console.error('Error processing dates for feature:', feature.properties.url, err);
                        errorCount++;
                    }
                })
                .on('error', reject)
                .on('end', () => {
                    if (errorCount > 0) {
                        console.warn(`Found ${errorCount} features with invalid dates`);
                    }
                    resolve(null);
                });
        });
    } finally {
        jsonParser.end();
    }

    if (!start || !end) {
        throw new Error('No valid dates found in dataset');
    }

    return { start, end };
}



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

interface CellMetadata {
    count: number;
    bounds: {
        minLon: number;
        maxLon: number;
        minLat: number;
        maxLat: number;
    };
}

interface FirstPassResult {
    cellCounts: Map<string, number>;
    entityGridIndices: Map<string, string>;
    cellMetadata: Map<string, CellMetadata>;
}


async function firstPassProcessJsonFeaturesToGrid(
    processedJsonPath: string,
    gridDimensions: GridDimensions
): Promise<FirstPassResult> {
    const cellMetadata = new Map<string, CellMetadata>();
    const entityGridIndices = new Map<string, string>();
    
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

                    const [row, col] = cellId.split('_').map(Number);

                    if (!cellMetadata.has(cellId)) {
                        cellMetadata.set(cellId, {
                            count: 0,
                            bounds: calculateCellBounds(row, col, gridDimensions)
                        });
                    }

                    const metadata = cellMetadata.get(cellId)!;
                    metadata.count++;

                    entityGridIndices.set(feature.properties.url, cellId);
                })
                .on('error', reject)
                .on('end', resolve);
        });
    } finally {
        jsonParser.end();
    }

    const cellCounts = new Map<string, number>();
    cellMetadata.forEach((metadata, cellId) => {
        if (metadata.count > 0) {
            cellCounts.set(cellId, metadata.count);
        }
    });

    return {
        cellCounts,
        entityGridIndices,
        cellMetadata
    };
}

async function secondPassProcessJsonFeaturesToGrid(
   processedJsonPath: string,
   binaryPath: string,
   firstPassResult: FirstPassResult,
   options: { gridDimensions: GridDimensions }
) {
   try {
       const timeRange = await findTimeRange(processedJsonPath);
       console.log(timeRange);

       const data = await fs.readFile(processedJsonPath, 'utf8');
       const features: GeoFeature[] = JSON.parse(data) as GeoFeature[];

       
       // Group features by cell
       const cellData: Record<string, GeoFeature[]> = {};
       for (const feature of features) {
           const cellId = firstPassResult.entityGridIndices.get(feature.properties.url);
           if (cellId) {
               cellData[cellId] = cellData[cellId] || [];
               cellData[cellId].push(feature);
           }
       }

       // Build cell indices with bounds and calculate heatmap cells
       const cellIndices: Record<string, BinaryCellIndex> = {};
       const heatmapCells: HeatmapCell[] = [];
       let dataOffset = 0;

       // Process only cells that have features
       for (const cellId in cellData) {
           const [row, col] = cellId.split('_').map(Number);
           const metadata = firstPassResult.cellMetadata.get(cellId);
           const encoded = encode(cellData[cellId]);
           
           if (!metadata) {
               console.warn(`No metadata found for cell ${cellId}`);
               continue;
           }

        cellIndices[cellId] = {
            startOffset: dataOffset,
            endOffset: dataOffset + encoded.byteLength,
            featureCount: cellData[cellId].length
        };




        heatmapCells.push({
            cellId,
            row,
            col,
            featureCount: cellData[cellId].length,
            bounds: metadata.bounds  
        });
           
           dataOffset += encoded.byteLength;
       }


       // Create metadata with prebaked heatmap
       const metadata: BinaryMetadata = {
           dimensions: options.gridDimensions,
           cellIndices,
           heatmap: {
               dimensions: options.gridDimensions,
               cells: heatmapCells
           } as Heatmap
       };

       // Write to binary file
       const writer = Bun.file(binaryPath).writer();
       const metadataBytes = encode(metadata);
       const metadataSize = metadataBytes.byteLength;

       // Write header size
       const sizeBuffer = Buffer.allocUnsafe(4);
       sizeBuffer.writeUInt32BE(metadataSize, 0);
       writer.write(sizeBuffer);

       // Write metadata (includes heatmap)
       writer.write(metadataBytes);

       // Write cell data
       for (const cellId in cellData) {
           writer.write(encode(cellData[cellId]));
       }

       await writer.end();
       console.log("Binary file written successfully!");

   } catch (error) {
       console.error("Error processing or writing binary file:", error);
       throw error;
   }
}
export {
   GeoJsonProcessingOptions,
   processGeoJsonFolderToFeatures,
   processFeaturesToGrid,
   calculateGridDimensions,
};

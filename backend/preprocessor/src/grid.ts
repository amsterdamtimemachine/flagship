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
    processedJsonPath: string,
    outputBinaryPath: string,
    config: GridConfig
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

    // First calculate dimensions from the data
    const gridDimensions = await calculateGridDimensions(processedJsonPath, config);
    
    // Then proceed with the grid processing using these dimensions
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

async function secondPassProcessJsonFeaturesToGrid(
  processedJsonPath: string,
  binaryPath: string,
  firstPassResult: { cellCounts: Map<string, number>, entityGridIndices: Map<string, string> },
  options: { gridDimensions: GridDimensions }
) {
      try {
        const data = await fs.readFile(processedJsonPath, 'utf8');
        const features: GeoFeature[] = JSON.parse(data) as GeoFeature[];

        const cellData: Record<string, GeoFeature[]> = {};
        for (const feature of features) {
          const cellId = firstPassResult.entityGridIndices.get(feature.properties.url);
          if (cellId) {
            cellData[cellId] = cellData[cellId] || [];
            cellData[cellId].push(feature);
          }
        }

        const cellIndices: Record<string, BinaryCellIndex> = {};
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

export {
   GeoJsonProcessingOptions,
   processGeoJsonFolderToFeatures,
   processFeaturesToGrid,
   getGridDimensionsFromConfig,
};

import { readdir, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';
import JSONStream from 'jsonstream';

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

async function processGeoJsonFolderToFeatures(
  geoJsonFeaturesFolderPath: string,
  processedJsonPath: string,
  options: GeoJsonProcessingOptions
) {
/**
* Processes multiple GeoJSON files from a directory and combines them into a single JSON array file.
* Uses streaming to handle large files. Each feature is processed through processFeature() 
**/ 
  const dir = dirname(processedJsonPath);
  await mkdir(dir, { recursive: true });
  
  const writer = Bun.file(processedJsonPath).writer();
  
  try {
      writer.write('[\n');
      let isFirst = true;
      const files = await readdir(geoJsonFeaturesFolderPath);
      const geoJsonFiles = files.filter(f => f.endsWith('.geojson'));
      
      for (const file of geoJsonFiles) {
          const jsonReadStream = createReadStream(join(geoJsonFeaturesFolderPath, file));
          const jsonParser = JSONStream.parse('features.*');
          
          try {
              await new Promise((resolve, reject) => {
                  jsonReadStream
                      .pipe(jsonParser)
                      .on('data', (feature: any) => {
                          const processed = processFeature(feature, options);
                          if (processed) {
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
          } finally {
              jsonParser.end();
          }
      }
      
      writer.write('\n]');
  } catch (error) {
      console.error('Error during geo json processing:', error);
      throw error;
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
    
    await secondPassProcessJsonFeaturesToGrid(
        processedJsonPath,
        outputBinaryPath,
        firstPassResult,
        {
            headerSize: 64,
            gridDimensions,
        }
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
interface BinaryWriteOptions {
    headerSize: number;
    gridDimensions: GridDimensions;
}

async function secondPassProcessJsonFeaturesToGrid(
  processedJsonPath: string,
  binaryPath: string,
  firstPassResult: FirstPassResult,
  options: BinaryWriteOptions
) {
   /**
   * Second pass to create final binary file containing both grid metadata and features.
   * File structure:
   * 1. Metadata size (4 bytes)
   * 2. Grid metadata (JSON)
   * 3. Feature data
   * 
   * @param processedJsonPath - Path to processed JSON file
   * @param binaryPath - Output path for binary file
   * @param firstPassResult - Grid indices from first pass
   * @param options - Binary writing options
   */
   const dir = dirname(binaryPath);
   await mkdir(dir, { recursive: true });
   
   // Create empty file
   await Bun.write(binaryPath, '');
   const binaryWriter = Bun.file(binaryPath).writer();
  
   // Create metadata
   const gridMetadata = {
       cellCounts: Array.from(firstPassResult.cellCounts.entries()),
       entityGridIndices: Array.from(firstPassResult.entityGridIndices.entries()),
       dimensions: options.gridDimensions,
       header: {
           totalFeatures: firstPassResult.cellCounts.size
       }
   };
  
   // Serialize metadata
   const metadataBytes = new TextEncoder().encode(JSON.stringify(gridMetadata));
   
   // Write metadata size as first 4 bytes
   const metadataSizeBuffer = new Uint32Array([metadataBytes.length]);
   binaryWriter.write(metadataSizeBuffer);
   
   // Write metadata
   binaryWriter.write(metadataBytes);

   // Write features
   const jsonReadStream = createReadStream(processedJsonPath);
   const jsonParser = JSONStream.parse('*'); 

   try {
       await new Promise((resolve, reject) => {
           jsonReadStream
               .pipe(jsonParser)
               .on('data', (feature: GeoFeature) => {
                   binaryWriter.write(JSON.stringify(feature) + '\n');
               })
               .on('error', reject)
               .on('end', resolve);
       });
   } finally {
       await binaryWriter.end();
       jsonParser.end();
   }
}

export {
   GeoJsonProcessingOptions,
   processGeoJsonFolderToFeatures,
   processFeaturesToGrid,
   getGridDimensionsFromConfig,
};

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
   CellPages,
   TimeSliceIndex,
   TimeSliceFeatures,
   HeatmapCell,
   HeatmapBlueprintCell,
   Heatmap,

} from '@atm/shared-types';

import { 
    type Coordinate,
    coordsMetersToLatLon, 
    calculateCentroid, 
    calculateMultiLineCentroid,
} from './geom';

interface GeoJsonProcessingOptions {
    dropNulls: boolean;
    convertMetersToLatLon: boolean;
    dropUndated: boolean; 
}

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
) : Promise<void> {
    const writer = Bun.file(processedJsonPath).writer();
    writer.write('[\n');
    let isFirst = true;
    let featureCount = 0;
    let droppedCount = { 
        geometry: 0, 
        validation: 0,
        dates: 0 
    };
    
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
                                // Process geometry
                                const processed = processFeature(feature, options);
                                if (!processed) {
                                    droppedCount.geometry++;
                                    return;
                                }

                                // Validate required fields
                                if (!validateFeature(processed)) {
                                    droppedCount.validation++;
                                    return;
                                }

                                // Validate dates
                                const hasStart = Boolean(processed.properties.start_date);
                                const hasEnd = Boolean(processed.properties.end_date);
                                if (options.dropUndated && !hasStart && !hasEnd) {
                                    droppedCount.dates++;
                                    return;
                                }

                                // Write valid feature
                                if (!isFirst) writer.write(',\n');
                                writer.write(JSON.stringify(processed));
                                isFirst = false;
                                featureCount++;
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
        console.log('Dropped features:', droppedCount);
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
                           // console.warn(`Invalid start_date: ${feature.properties.start_date} for feature ${feature.properties.url}`);
                            errorCount++;
                            return;
                        }

                        if (isNaN(featureEnd.getTime())) {
                           // console.warn(`Invalid end_date: ${feature.properties.end_date} for feature ${feature.properties.url}`);
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


function featureFitsTimeSlice(feature: GeoFeature, sliceStart: Date, sliceEnd: Date): boolean {
    const start = feature.properties.start_date ? new Date(feature.properties.start_date) : null;
    const end = feature.properties.end_date ? new Date(feature.properties.end_date) : null;

    // Both dates exist - check if feature spans slice
    if (start && end) {
        return start <= sliceEnd && end >= sliceStart;
    }

    // Only start date exists
    if (start) {
        return start >= sliceStart && start <= sliceEnd;
    }

    // Only end date exists
    if (end) {
        return end >= sliceStart && end <= sliceEnd;
    }

    // No dates - include in all slices
    return true;
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


interface ProcessingOptions {
    sliceYears: number;
    pageSize: number;
}

async function processFeaturesToTimeBinary(
    processedJsonPath: string,
    binaryPath: string,
    gridDimensions: GridDimensions,
    options: ProcessingOptions
) : Promise<void> {
    // Read features
    console.log('Reading features...');
    const rawData = await fs.readFile(processedJsonPath, 'utf8');
    const features: GeoFeature[] = JSON.parse(rawData);
    
    // Find the total time range
    console.log('Computing time range...');
    let minStart = Infinity;
    let maxEnd = -Infinity;
    for (const feature of features) {
        const startDate = new Date(feature.properties.start_date).getTime();
        const endDate = new Date(feature.properties.end_date).getTime();
        
        if (!isNaN(startDate)) minStart = Math.min(minStart, startDate);
        if (!isNaN(endDate)) maxEnd = Math.max(maxEnd, endDate);
    }

    const timeRange = {
        start: new Date(minStart),
        end: new Date(maxEnd)
    };
    
    // Initialize time slices
    console.log('Creating time slices...');
    const timeSlices: Record<string, TimeSliceFeatures> = {};
    for (let year = timeRange.start.getFullYear(); year < timeRange.end.getFullYear(); year += options.sliceYears) {
        const period = `${year}_${year + options.sliceYears}`;
        timeSlices[period] = {
            cells: {}
        };
    }

    // Group features by time and cell
    console.log('Processing features into time slices...');
    for (const feature of features) {

        // get the center of the feature
        let point: Point2D | undefined;
        if (feature.geometry.type === "Point") {
            point = { x: feature.geometry.coordinates[0], y: feature.geometry.coordinates[1] };
        } else {
            point = feature.geometry.centroid;
        }
        if (!point) continue;
        
        // find the grid cell to which the feature belongs to 
        const cellId = getCellIdForPoint(point, gridDimensions);
        if (!cellId) continue;

        for (const [period, slice] of Object.entries(timeSlices as Record<string, TimeSliceFeatures>)) {
            const [startYear, endYear] = period.split('_').map(Number);
            const sliceStart = new Date(startYear, 0);
            const sliceEnd = new Date(endYear, 0);

            if (featureFitsTimeSlice(feature, sliceStart, sliceEnd)) {
                if (!slice.cells[cellId]) {
                    slice.cells[cellId] = {
                        count: 0,
                        pages: {}
                    };
                }

                const cell = timeSlices[period].cells[cellId];
                const pageNum = Math.floor(cell.count / options.pageSize) + 1;
                const pageKey = `page${pageNum}`;

                // Initialize page if needed
                if (!cell.pages[pageKey]) {
                    cell.pages[pageKey] = [];
                }

                // Add feature to current page
                cell.pages[pageKey].push(feature);
                cell.count++;
            }
        }
    }

    const heatmaps: Record<string, Heatmap> = {};
    for (const [period, slice] of Object.entries(timeSlices as Record<string, TimeSliceFeatures>)) {
        const cells: HeatmapCell[] = [];
        
        // First find max count for this period
        const maxCount = Math.max(
            ...Object.values(slice.cells)
                .map(cellData => cellData.count)
        );

        // Calculate max transformed value for normalization
        const maxTransformedCount = Math.log(maxCount + 1);

        for (const [cellId, cellData] of Object.entries(slice.cells)) {
            if (cellData.count === 0) continue;
            
            const [row, col] = cellId.split('_').map(Number);
            const bounds = calculateCellBounds(row, col, gridDimensions);
            
            // Calculate log-scaled normalized density
            const transformedCount = Math.log(cellData.count + 1);
            const countDensity = transformedCount / maxTransformedCount;
            
            cells.push({
                cellId,
                row,
                col,
                featureCount: cellData.count,
                countDensity,
                bounds
            } as HeatmapCell);
        }
        heatmaps[period] = { period, cells };
    }

    // Then in the processing code, after generating heatmaps:
    console.log('Generating heatmap blueprint...');
    const heatmapBlueprint = new Map<string, HeatmapBlueprintCell>();

    // Collect all unique cells from all heatmaps
    for (const heatmap of Object.values(heatmaps)) {
       for (const cell of heatmap.cells) {
           if (!heatmapBlueprint.has(cell.cellId)) {
               heatmapBlueprint.set(cell.cellId, {
                   cellId: cell.cellId,
                   row: cell.row,
                   col: cell.col,
                   bounds: cell.bounds
               });
           }
       }
    }


    // calculate byte offsets
    let currentOffset = 0;
    const timeSliceIndex: Record<string, TimeSliceIndex> = {};

    for (const [period, slice] of Object.entries(timeSlices)) {
        const sliceStartOffset = currentOffset;

        const pageLocations: Record<string, CellPages> = {};

    // Calculate offsets for each page in this slice
    for (const [cellId, cell] of Object.entries(slice.cells)) {
        pageLocations[cellId] = {};

        for (const [pageNum, features] of Object.entries(cell.pages)) {
            const encodedFeatures = encode(features);
            pageLocations[cellId][pageNum] = {
                offset: currentOffset,
                length: encodedFeatures.byteLength
            };
            currentOffset += encodedFeatures.byteLength;
        }
    }

    timeSliceIndex[period] = {
        offset: sliceStartOffset,
        pages: pageLocations
    };
    }

    // Write the binary
    console.log('Writing binary file...');
    const writer = Bun.file(binaryPath).writer();

    // Write metadata
    const metadata: BinaryMetadata = {
        dimensions: gridDimensions,
        timeRange: {
            start: timeRange.start.toISOString(),
            end: timeRange.end.toISOString()
        },
        timeSliceIndex,
        heatmaps,
        heatmapBlueprint: {
            cells: Array.from(heatmapBlueprint.values())
        }
    };

    const metadataBytes = encode(metadata);
    const metadataSize = metadataBytes.byteLength;
    
    const sizeBuffer = Buffer.allocUnsafe(4);
    sizeBuffer.writeUInt32BE(metadataSize, 0);
    writer.write(sizeBuffer);
    writer.write(metadataBytes);

    // Write features in same order we calculated offsets
    for (const [_, slice] of Object.entries(timeSlices)) {
        for (const [_, cell] of Object.entries(slice.cells)) {
            for (const [_, features] of Object.entries(cell.pages)) {
                writer.write(encode(features));
            }
        }
    }

    await writer.end();
}

// STREAMING VERSION, probably still breaks the binary for some reason.
//async function processFeaturesToTimeBinary(
//    processedJsonPath: string,
//    binaryPath: string,
//    gridDimensions: GridDimensions,
//    options: { sliceYears: number }
//) {
//    // Step 1: First pass to find time range and prepare slices
//    const timeRange = await findTimeRange(processedJsonPath);
//    const startYear = timeRange.start.getFullYear();
//    const endYear = timeRange.end.getFullYear();
//    
//    // Create time slice buckets
//    const timeSlices: Record<string, TimeSliceFeatures> = {};
//    for (let year = startYear; year < endYear; year += options.sliceYears) {
//        const period = `${year}-${year + options.sliceYears}`;
//        timeSlices[period] = {
//            cells: {}
//        };
//    }
//
//    // Step 2: Process features into time slices and cells
//    const jsonReadStream = createReadStream(processedJsonPath);
//    const jsonParser = JSONStream.parse('*');
//
//    await new Promise((resolve, reject) => {
//        jsonReadStream
//            .pipe(jsonParser)
//            .on('data', (feature: GeoFeature) => {
//                // Get feature's point (either direct point or centroid)
//                let point: Point2D | undefined;
//                if (feature.geometry.type === "Point") {
//                    point = {
//                        x: feature.geometry.coordinates[0],
//                        y: feature.geometry.coordinates[1]
//                    };
//                } else {
//                    point = feature.geometry.centroid;
//                }
//                if (!point) return;
//
//                // Get cell for this feature
//                const cellId = getCellIdForPoint(point, gridDimensions);
//                if (!cellId) return;
//
//                // Add to relevant time slices
//                for (let year = startYear; year < endYear; year += options.sliceYears) {
//                    const period = `${year}-${year + options.sliceYears}`;
//                    const sliceStart = new Date(year, 0);
//                    const sliceEnd = new Date(year + options.sliceYears, 0);
//
//                    if (featureFitsTimeSlice(feature, sliceStart, sliceEnd)) {
//                        if (!timeSlices[period].cells[cellId]) {
//                            timeSlices[period].cells[cellId] = {
//                                features: [],
//                                count: 0
//                            };
//                        }
//                        timeSlices[period].cells[cellId].features.push(feature);
//                        timeSlices[period].cells[cellId].count++;
//                    }
//                }
//            })
//            .on('error', reject)
//            .on('end', resolve);
//    });
//
//    // Step 3: Generate heatmaps
//    const heatmaps: Record<string, Heatmap> = {};
//    for (const [period, slice] of Object.entries(timeSlices)) {
//        const cells: HeatmapCell[] = [];
//        
//        for (const [cellId, cellData] of Object.entries(slice.cells)) {
//            if (cellData.count === 0) continue;
//            
//            const [row, col] = cellId.split('_').map(Number);
//            const bounds = calculateCellBounds(row, col, gridDimensions);
//            
//            cells.push({
//                cellId,
//                row,
//                col,
//                featureCount: cellData.count,
//                bounds
//            });
//        }
//
//        heatmaps[period] = {
//            period,
//            cells
//        };
//    }
//
//    // Step 4: Write binary file
//    const writer = Bun.file(binaryPath).writer();
//    
//    // Build metadata
//    const timeSliceIndex: Record<string, TimeSliceIndex> = {};
//    let currentOffset = 0;
//    
//    // Calculate offsets for time slices
//    for (const [period, slice] of Object.entries(timeSlices)) {
//        const encoded = encode(slice);
//        timeSliceIndex[period] = {
//            offset: currentOffset,
//            length: encoded.byteLength
//        };
//        currentOffset += encoded.byteLength;
//    }
//
//    const metadata: BinaryMetadata = {
//        dimensions: gridDimensions,
//        timeRange: {
//            start: timeRange.start.toISOString(),
//            end: timeRange.end.toISOString()
//        },
//        timeSliceIndex,
//        heatmaps
//    };
//
//    // Write metadata
//    const metadataBytes = encode(metadata);
//    const metadataSize = metadataBytes.byteLength;
//    
//    const sizeBuffer = Buffer.allocUnsafe(4);
//    sizeBuffer.writeUInt32BE(metadataSize, 0);
//    writer.write(sizeBuffer);
//    writer.write(metadataBytes);
//
//    // Write time slice data
//    for (const slice of Object.values(timeSlices)) {
//        writer.write(encode(slice));
//    }
//
//    await writer.end();
//    console.log("Binary file written successfully!");
//}


export {
   GeoJsonProcessingOptions,
   processGeoJsonFolderToFeatures,
   processFeaturesToTimeBinary,
   calculateGridDimensions,
};

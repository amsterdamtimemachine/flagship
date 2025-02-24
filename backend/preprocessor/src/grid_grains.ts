import { readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import JSONStream from 'jsonstream';
import { decode, encode } from '@msgpack/msgpack';
import * as fs from 'node:fs/promises';

import type { 
   Point2D,
   GeoFeatures,
   GridDimensions,
   TimeSlice,
   TimeSliceIndex,
   ContentClass,
   ContentFeatures,
   ContentOffsets,
   ContentTagOffsets,
   ContentClassPage,
   Heatmap,
   HeatmapCell,
   HeatmapBlueprint,
   CellData,
   BinaryMetadata,
   HeatmapStack,
   Heatmaps,
} from '@atm/shared-types';

interface ProcessingOptions {
    sliceYears: number;
    pageSize: number;
}


interface ProcessingResult {
    gridDimensions: GridDimensions;
    featuresStatistics: BinaryMetadata['featuresStatistics'],
    timeSlices: Record<string, TimeSlice>;
    timeRange: {
        start: Date;
        end: Date;
    };
    timePeriods: string[],
    heatmaps: Record<string, {
        contentClasses: {
            [K in ContentClass]: {
                base: Heatmap;
                tags: {
                    [tagName: string]: Heatmap;
                }
            }
        }
    }>;
    heatmapBlueprint: HeatmapBlueprint;
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

function doesFeatureFitTimeSlice(feature: GeoFeatures, sliceStart: Date, sliceEnd: Date): boolean {
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

function getTotalTimeRange(features: GeoFeatures[]): {start: Date, end: Date} {
    let minStart = Infinity;
    let maxEnd = -Infinity;

    for (const feature of features) {
        const startDate = new Date(feature.properties.start_date).getTime();
        const endDate = feature.properties.end_date ? 
            new Date(feature.properties.end_date).getTime() : startDate;
        
        if (!isNaN(startDate)) minStart = Math.min(minStart, startDate);
        if (!isNaN(endDate)) maxEnd = Math.max(maxEnd, endDate);
    }

    return {
        start: new Date(minStart),
        end: new Date(maxEnd)
    };
}



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


function addFeatureToCell(
    feature: GeoFeatures,  
    cell: CellData,
    pageKey: string
) {
    const contentClass = feature.content_class;
    // Type assertion to match the content class
    (cell.contentIndex[contentClass].features as GeoFeatures[]).push(feature);
    cell.contentIndex[contentClass].count++;
    (cell.pages[pageKey][contentClass] as GeoFeatures[]).push(feature);
    cell.count++;
}


function collectFeaturesStatistics(features: GeoFeatures[]): BinaryMetadata['featuresStatistics'] {
    const featuresStatistics: BinaryMetadata['featuresStatistics'] = {
        contentClasses: {
            Image: {
                total: 0,
                ai: {
                    environment: {},
                    tags: { total: 0, tags: {} },
                    attributes: { total: 0, tags: {} }
                }
            },
            Event: {
                total: 0
            }
        },
        totalFeatures: features.length
    };

    for (const feature of features) {
        const contentClass = feature.content_class;
        featuresStatistics.contentClasses[contentClass].total++;

        if (feature.properties.ai) {
            // Initialize ai statistics object if it doesn't exist
            if (!featuresStatistics.contentClasses[contentClass].ai) {
                featuresStatistics.contentClasses[contentClass].ai = {
                    environment: {},
                    tags: { total: 0, tags: {} },
                    attributes: { total: 0, tags: {} }
                };
            }

            // Process AI data
            if (feature.properties.ai.environment) {
                const env = feature.properties.ai.environment;
                featuresStatistics.contentClasses[contentClass].ai!.environment![env] = 
                    (featuresStatistics.contentClasses[contentClass].ai!.environment![env] || 0) + 1;
            }

            if (feature.properties.ai.tags) {
                feature.properties.ai.tags.forEach(tag => {
                    featuresStatistics.contentClasses[contentClass].ai!.tags!.total++;
                    featuresStatistics.contentClasses[contentClass].ai!.tags!.tags[tag] = 
                        (featuresStatistics.contentClasses[contentClass].ai!.tags!.tags[tag] || 0) + 1;
                });
            }

            if (feature.properties.ai.attributes) {
                feature.properties.ai.attributes.forEach(attr => {
                    featuresStatistics.contentClasses[contentClass].ai!.attributes!.total++;
                    featuresStatistics.contentClasses[contentClass].ai!.attributes!.tags[attr] = 
                        (featuresStatistics.contentClasses[contentClass].ai!.attributes!.tags[attr] || 0) + 1;
                });
            }
        }
    }

    return featuresStatistics;
}
export async function processFeatures(
    processedJsonPath: string,
    gridDimensions: GridDimensions,
    options: ProcessingOptions
): Promise<ProcessingResult> {
    // Read features
    const rawData = await fs.readFile(processedJsonPath, 'utf8');
    const features: GeoFeatures[] = JSON.parse(rawData);
    
    // Get content classes from data
    const contentClasses = Array.from(
        new Set(features.map(f => f.content_class))
    ) as ContentClass[];

    const featuresStatistics = collectFeaturesStatistics(features);

    // Initialize time slices
    const timeRange = getTotalTimeRange(features);
    const timeSlices: Record<string, TimeSlice> = {};
    let timePeriods: string[] = [];
    
    // Initialize period slices based on options.sliceYears
    for (let year = timeRange.start.getFullYear(); year < timeRange.end.getFullYear(); year += options.sliceYears) {
        const period = `${year}_${year + options.sliceYears}`;
        timeSlices[period] = {
            cells: {}
        };
        timePeriods.push(period);
    }

    // Process features into time slices
    for (const feature of features) {
        const point = feature.geometry.type === "Point" 
            ? { x: feature.geometry.coordinates[0], y: feature.geometry.coordinates[1] }
            : feature.geometry.centroid;
            
        if (!point) continue;
        
        const cellId = getCellIdForPoint(point, gridDimensions);
        if (!cellId) continue;

        for (const [period, slice] of Object.entries(timeSlices)) {
            const [startYear, endYear] = period.split('_').map(Number);
            const sliceStart = new Date(startYear, 0);
            const sliceEnd = new Date(endYear, 0);

            if (doesFeatureFitTimeSlice(feature, sliceStart, sliceEnd)) {
               if (!slice.cells[cellId]) {
                  slice.cells[cellId] = {
                     count: 0,
                     contentIndex: Object.fromEntries(
                        contentClasses.map(cls => [
                           cls, 
                           { features: [], count: 0 }
                        ])
                     ) as ContentFeatures,
                     pages: {}
                  };
               }

                const cell = slice.cells[cellId];
                
                // Add to content class index
                const contentClass = feature.content_class;
                (cell.contentIndex[contentClass].features as GeoFeatures[]).push(feature);
                cell.contentIndex[contentClass].count++;
                
                // Add to pagination
                const pageNum = Math.floor(cell.count / options.pageSize) + 1;
                const pageKey = `page${pageNum}`;

                if (!cell.pages[pageKey]) {
                   cell.pages[pageKey] = Object.fromEntries(
                      contentClasses.map(cls => [cls, []])
                   ) as ContentClassPage;
                }
                
               (cell.pages[pageKey][contentClass] as GeoFeatures[]).push(feature);
                cell.count++;
            }
        }
    }

    const totalCells = gridDimensions.rowsAmount * gridDimensions.colsAmount;
    const heatmaps: Heatmaps = {};
    
    for (const [period, slice] of Object.entries(timeSlices)) {
        // Initialize heatmap structure for this period
        heatmaps[period] = {
            contentClasses: {} as HeatmapStack
        };
        
        // Process each content class
        for (const contentClass of contentClasses) {
            // Create base arrays for this content class
            const baseCountArray = new Float32Array(totalCells);
            
            // Collect tag names for this content class
            const tagNames = new Set<string>();
            
            // Fill content class arrays and collect tags
            for (const [cellId, cellData] of Object.entries(slice.cells)) {
                if (cellData.contentIndex[contentClass].count > 0) {
                    const [row, col] = cellId.split('_').map(Number);
                    const index = row * gridDimensions.colsAmount + col;
                    
                    // Set count value
                    baseCountArray[index] = cellData.contentIndex[contentClass].count;
                    
                    // Collect tags from features
                    for (const feature of cellData.contentIndex[contentClass].features) {
                        if (feature.properties.ai?.tags) {
                            feature.properties.ai.tags.forEach(tag => tagNames.add(tag));
                        }
                    }
                }
            }
            
            // Calculate base density array
            const maxBaseCount = Math.max(...baseCountArray);
            const baseDensityArray = new Float32Array(totalCells);
            
            if (maxBaseCount > 0) {
                const maxTransformed = Math.log(maxBaseCount + 1);
                for (let i = 0; i < totalCells; i++) {
                    baseDensityArray[i] = baseCountArray[i] > 0 ? 
                        Math.log(baseCountArray[i] + 1) / maxTransformed : 0;
                }
            }
            
            // Create heatmap entry for this content class
            heatmaps[period].contentClasses[contentClass] = {
                base: {
                    countArray: baseCountArray,
                    densityArray: baseDensityArray
                },
                tags: {}
            };
            
            // Process each tag for this content class
            for (const tagName of tagNames) {
                const tagCountArray = new Float32Array(totalCells);
                
                // Fill tag count array
                for (const [cellId, cellData] of Object.entries(slice.cells)) {
                    if (cellData.contentIndex[contentClass].count > 0) {
                        const [row, col] = cellId.split('_').map(Number);
                        const index = row * gridDimensions.colsAmount + col;
                        
                        // Count features with this tag
                        const taggedFeatures = cellData.contentIndex[contentClass].features.filter(
                            f => f.properties.ai?.tags?.includes(tagName)
                        );
                        
                        tagCountArray[index] = taggedFeatures.length;
                    }
                }
                
                // Calculate tag density array
                const maxTagCount = Math.max(...tagCountArray);
                const tagDensityArray = new Float32Array(totalCells);
                
                if (maxTagCount > 0) {
                    const maxTransformed = Math.log(maxTagCount + 1);
                    for (let i = 0; i < totalCells; i++) {
                        tagDensityArray[i] = tagCountArray[i] > 0 ? 
                            Math.log(tagCountArray[i] + 1) / maxTransformed : 0;
                    }
                }
                
                // Store tag heatmap
                heatmaps[period].contentClasses[contentClass].tags[tagName] = {
                    countArray: tagCountArray,
                    densityArray: tagDensityArray
                };
            }
        }
    }

    // Generate heatmap blueprint
    const blueprintCells: HeatmapCell[] = [];
    
    for (let row = 0; row < gridDimensions.rowsAmount; row++) {
        for (let col = 0; col < gridDimensions.colsAmount; col++) {
            const cellId = `${row}_${col}`;
            const bounds = calculateCellBounds(row, col, gridDimensions);
            
            blueprintCells.push({
                cellId,
                row,
                col,
                bounds
            });
        }
    }

    const heatmapBlueprint: HeatmapBlueprint = {
        rows: gridDimensions.rowsAmount,
        cols: gridDimensions.colsAmount,
        cells: blueprintCells
    };

    return {
        timeSlices,
        gridDimensions,
        timeRange,
        timePeriods,
        featuresStatistics,
        heatmaps,
        heatmapBlueprint
    };
}

export async function saveFeaturesToBinary(
    processingResult: ProcessingResult,  
    binaryPath: string
): Promise<void> {
    console.log("Calculating offsets...");
    let currentOffset = 0;
    const timeSliceIndex: Record<string, TimeSliceIndex> = {};

    // First pass: Calculate all offsets
    for (const [period, slice] of Object.entries(processingResult.timeSlices)) {
        const sliceStartOffset = currentOffset;
        
        const cellIndices: Record<string, {
            contentOffsets: ContentOffsets;
            contentTagOffsets: ContentTagOffsets;
            pages: Record<string, {
                [T in ContentClass]: {
                    offset: number;
                    length: number;
                }
            }>;
        }> = {};

        for (const [cellId, cell] of Object.entries(slice.cells)) {
            // Calculate content class offsets
            const contentOffsets = Object.entries(cell.contentIndex).reduce((acc, [className, content]) => {
                const contentClass = className as ContentClass;
                if (content.features.length === 0) {
                    return {
                        ...acc,
                        [contentClass]: { offset: 0, length: 0 }  // Zero for empty features
                    };
                }
                
                const encoded = encode(content.features);
                const offset = currentOffset;
                const length = encoded.byteLength;
                currentOffset += length;
                
                return {
                    ...acc,
                    [contentClass]: { offset, length }
                };
            }, {} as ContentOffsets);

            // Calculate content class + tag offsets
            const contentTagOffsets = {} as ContentTagOffsets;
            
            for (const [className, content] of Object.entries(cell.contentIndex)) {
                const contentClass = className as ContentClass;
                contentTagOffsets[contentClass] = {};
                
                // Skip if no features
                if (content.features.length === 0) continue;
                
                // Collect all tags for this content class
                const tagMap = new Map<string, GeoFeatures[]>();
                
                for (const feature of content.features) {
                    if (feature.properties.ai?.tags) {
                        for (const tag of feature.properties.ai.tags) {
                            if (!tagMap.has(tag)) {
                                tagMap.set(tag, []);
                            }
                            tagMap.get(tag)!.push(feature);
                        }
                    }
                }
                
                // Calculate offsets for each tag
                for (const [tag, taggedFeatures] of tagMap.entries()) {
                    const encoded = encode(taggedFeatures);
                    const offset = currentOffset;
                    const length = encoded.byteLength;
                    currentOffset += length;
                    
                    contentTagOffsets[contentClass][tag] = { offset, length };
                }
            }

            // Calculate page offsets (unchanged from your original code)
            const pageOffsets = Object.entries(cell.pages).reduce((acc, [pageNum, page]) => {
                const pageContentOffsets = Object.entries(page).reduce((innerAcc, [className, features]) => {
                    const contentClass = className as ContentClass;
                    if (features.length === 0) {
                        return {
                            ...innerAcc,
                            [contentClass]: { offset: 0, length: 0 }
                        };
                    }
                    
                    const encoded = encode(features);
                    const offset = currentOffset;
                    const length = encoded.byteLength;
                    currentOffset += length;
                    
                    return {
                        ...innerAcc,
                        [contentClass]: { offset, length }
                    };
                }, {} as any);

                return {
                    ...acc,
                    [pageNum]: pageContentOffsets
                };
            }, {});

            cellIndices[cellId] = {
                contentOffsets,
                contentTagOffsets,
                pages: pageOffsets
            };
        }

        timeSliceIndex[period] = {
            offset: sliceStartOffset,
            cells: cellIndices
        };
    }

    console.log("Writing binary file...");
    const writer = Bun.file(binaryPath).writer();

    // Write metadata first
    const metadata: BinaryMetadata = {
        dimensions: processingResult.gridDimensions,
        featuresStatistics: processingResult.featuresStatistics,
        timeRange: {
            start: processingResult.timeRange.start.toISOString(),
            end: processingResult.timeRange.end.toISOString()
        },
        timePeriods: processingResult.timePeriods,
        timeSliceIndex,
        heatmaps: processingResult.heatmaps,
        heatmapBlueprint: processingResult.heatmapBlueprint
    };

    const metadataBytes = encode(metadata);
    const metadataSize = metadataBytes.byteLength;
    
    const sizeBuffer = Buffer.allocUnsafe(4);
    sizeBuffer.writeUInt32BE(metadataSize, 0);
    writer.write(sizeBuffer);
    writer.write(metadataBytes);

    // Write features in exact same order we calculated offsets
    for (const [period, slice] of Object.entries(processingResult.timeSlices)) {
        for (const [cellId, cell] of Object.entries(slice.cells)) {
            // Write content class features
            for (const [className, content] of Object.entries(cell.contentIndex)) {
                if (content.features.length > 0) {
                    writer.write(encode(content.features));
                }
            }
            
            // Write content class + tag features
            for (const [className, content] of Object.entries(cell.contentIndex)) {
                const contentClass = className as ContentClass;
                if (content.features.length === 0) continue;
                
                // Process each tag
                const tagMap = new Map<string, GeoFeatures[]>();
                
                for (const feature of content.features) {
                    if (feature.properties.ai?.tags) {
                        for (const tag of feature.properties.ai.tags) {
                            if (!tagMap.has(tag)) {
                                tagMap.set(tag, []);
                            }
                            tagMap.get(tag)!.push(feature);
                        }
                    }
                }
                
                // Write each tag's features
                for (const taggedFeatures of tagMap.values()) {
                    if (taggedFeatures.length > 0) {
                        writer.write(encode(taggedFeatures));
                    }
                }
            }

            // Write paged features
            for (const [_, page] of Object.entries(cell.pages)) {
                for (const [className, features] of Object.entries(page)) {
                    if (features.length > 0) {
                        writer.write(encode(features));
                    }
                }
            }
        }
    }

    await writer.end();
    console.log(`Binary file written to ${binaryPath}`);
}

export async function testBinaryLoading(binaryPath: string) {
    console.log("Testing binary loading...");
    const mmap = Bun.mmap(binaryPath);
    const buffer = mmap.buffer;
    
    // Read metadata
    const dataView = new DataView(buffer);
    const metadataSize = dataView.getUint32(0, false);
    console.log("Metadata size:", metadataSize);
    
    const metadataBytesRead = new Uint8Array(buffer, 4, metadataSize);
    const metadata = decode(metadataBytesRead) as BinaryMetadata;
    
    // Print metadata overview
    console.log("\nMetadata Overview:");
    console.log("Time range:", metadata.timeRange.start, "to", metadata.timeRange.end);

    console.log("Time periods", metadata.timePeriods);
    console.log("Number of time periods:", Object.keys(metadata.timeSliceIndex).length);
    
    // Test heatmaps
    const firstPeriod = Object.keys(metadata.heatmaps)[0];
    if (firstPeriod) {
        console.log("\nTesting heatmap for period:", firstPeriod);
        const heatmap = metadata.heatmaps[firstPeriod];
        
        for (const contentClass of Object.keys(heatmap.contentClasses) as ContentClass[]) {
            console.log(`\nContent class: ${contentClass}`);
            console.log(`Base heatmap has ${heatmap.contentClasses[contentClass].base.countArray.length} cells`);
            
            const tags = Object.keys(heatmap.contentClasses[contentClass].tags);
            console.log(`Has ${tags.length} tag heatmaps:`, tags.slice(0, 5));
        }
    }
    
    // Test feature retrieval
    const firstTimeSlicePeriod = Object.keys(metadata.timeSliceIndex)[0];
    if (firstTimeSlicePeriod) {
        const timeSlice = metadata.timeSliceIndex[firstTimeSlicePeriod];
        const firstCellId = Object.keys(timeSlice.cells)[0];
        
        if (firstCellId) {
            console.log(`\nTesting feature retrieval for cell ${firstCellId} in period ${firstTimeSlicePeriod}`);
            const cell = timeSlice.cells[firstCellId];
            
            // Test content class retrieval
            for (const contentClass of Object.keys(cell.contentOffsets) as ContentClass[]) {
                const contentOffset = cell.contentOffsets[contentClass];
                
                if (contentOffset.length > 0) {
                    console.log(`\nRetrieving ${contentClass} features:`);
                    const featuresBytes = new Uint8Array(
                        buffer,
                        4 + metadataSize + contentOffset.offset,
                        contentOffset.length
                    );
                    
                    const features = decode(featuresBytes) as GeoFeatures[];
                    console.log(`Found ${features.length} ${contentClass} features`);
                    
                    // Test tag retrieval if tags exist
                    if (cell.contentTagOffsets[contentClass]) {
                        const firstTag = Object.keys(cell.contentTagOffsets[contentClass])[0];
                        
                        if (firstTag) {
                            const tagOffset = cell.contentTagOffsets[contentClass][firstTag];
                            
                            console.log(`\nRetrieving ${contentClass} features with tag "${firstTag}":`);
                            const taggedFeaturesBytes = new Uint8Array(
                                buffer,
                                4 + metadataSize + tagOffset.offset,
                                tagOffset.length
                            );
                            
                            const taggedFeatures = decode(taggedFeaturesBytes) as GeoFeatures[];
                            console.log(`Found ${taggedFeatures.length} ${contentClass} features with tag "${firstTag}"`);
                        }
                    }
                }
            }
        }
    }
    
    console.log("\nBinary loading test complete");
}

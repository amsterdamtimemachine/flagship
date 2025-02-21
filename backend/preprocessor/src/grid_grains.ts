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
   CellContentIndex,
   TimeSliceIndex,
   TimeSlice,
   ContentClass,
   ContentOffsets,
   ContentClassPage,
   Heatmap,
   HeatmapCell,
   HeatmapBlueprintCell,
   CellData,
   BinaryMetadata,
} from '@atm/shared-types';

interface ProcessingOptions {
    sliceYears: number;
    pageSize: number;
}


interface ProcessingResult {
    gridDimensions: GridDimensions;
    featuresStatistics: BinaryMetadata['statistics'],
    timeSlices: Record<string, TimeSlice>;
    timeRange: {
        start: Date;
        end: Date;
    };
    heatmaps: Record<string, Heatmap>;
    heatmapBlueprint: {
        cells: HeatmapBlueprintCell[];
    };
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


function collectFeaturesStatistics(features: GeoFeatures[]): BinaryMetadata['statistics'] {
    const featuresStatistics: BinaryMetadata['statistics'] = {
        contentClasses: {
            Image: {
                total: 0,
                ai: {  // Initialize if we have AI data
                    environment: {},
                    tags: { total: 0, tags: {} },
                    attributes: { total: 0, tags: {} }
                }
            },
            Event: {
                total: 0  // No ai field initialized by default
            }
        },
        totalFeatures: features.length
    };

    for (const feature of features) {
        const contentClass = feature.content_class;
        featuresStatistics.contentClasses[contentClass].total++;

        if (feature.properties.ai) {
            // Initialize ai featuresStatistics object if it doesn't exist
            if (!featuresStatistics.contentClasses[contentClass].ai) {
                featuresStatistics.contentClasses[contentClass].ai = {
                    environment: {},
                    tags: { total: 0, tags: {} },
                    attributes: { total: 0, tags: {} }
                };
            }

            // Now safely process AI data
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
    for (let year = timeRange.start.getFullYear(); year < timeRange.end.getFullYear(); year += options.sliceYears) {
        const period = `${year}_${year + options.sliceYears}`;
        timeSlices[period] = {
            cells: {}
        };
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
                     contentIndex: contentClasses.reduce((acc, content_class) => ({
                        ...acc,
                        [content_class]: { features: [], count: 0 }
                     }), {} as CellContentIndex),
                     pages: {}
                  };
               }

               const cell = slice.cells[cellId];
               const pageNum = Math.floor(cell.count / options.pageSize) + 1;
               const pageKey = `page${pageNum}`;

               if (!cell.pages[pageKey]) {
                  cell.pages[pageKey] = contentClasses.reduce((acc, cls) => ({
                     ...acc,
                     [cls]: []
                  }), {} as ContentClassPage);
               }

               addFeatureToCell(feature, cell, pageKey);
            }
        }
    }

    // Generate heatmaps
    const heatmaps: Record<string, Heatmap> = {};
    for (const [period, slice] of Object.entries(timeSlices)) {
       const cells: HeatmapCell[] = [];

       // Find max counts for each content class
       const maxCounts = contentClasses.reduce((acc, cls) => ({
          ...acc,
          [cls]: Math.max(
             ...Object.values(slice.cells)
             .map(cell => cell.contentIndex[cls].count)
          )
       }), {} as Record<ContentClass, number>);

       const maxTotal = Math.max(
          ...Object.values(slice.cells)
          .map(cell => cell.count)
       );

       // Calculate log-scaled max values, handle zero case
       const maxTransformed = {
          ...contentClasses.reduce((acc, cls) => ({
             ...acc,
             [cls]: maxCounts[cls] > 0 ? Math.log(maxCounts[cls] + 1) : 1  // Use 1 if no features
          }), {}),
       total: maxTotal > 0 ? Math.log(maxTotal + 1) : 1
       };

       for (const [cellId, cellData] of Object.entries(slice.cells)) {
          if (cellData.count === 0) continue;

          const [row, col] = cellId.split('_').map(Number);
          const bounds = calculateCellBounds(row, col, gridDimensions);

          // Calculate counts and densities
          const counts = {
             ...contentClasses.reduce((acc, cls) => ({
                ...acc,
                [cls]: cellData.contentIndex[cls].count
             }), {}),
             total: cellData.count
          };

          const densities = {
             ...contentClasses.reduce((acc, cls) => ({
                ...acc,
                [cls]: maxTransformed[cls] > 0 ? Math.log(counts[cls] + 1) / maxTransformed[cls] : 0  // Return 0 for empty content class
             }), {}),
          total: maxTransformed.total > 0 ? Math.log(counts.total + 1) / maxTransformed.total : 0
          };

          cells.push({
             cellId,
             row,
             col,
             counts,
             densities,
             bounds
          } as HeatmapCell);
       }

       heatmaps[period] = { period, cells };
    }

    // Generate heatmap blueprint
    const blueprintCells = new Map<string, HeatmapBlueprintCell>();
    for (const heatmap of Object.values(heatmaps)) {
        for (const cell of heatmap.cells) {
            if (!blueprintCells.has(cell.cellId)) {
                blueprintCells.set(cell.cellId, {
                    cellId: cell.cellId,
                    row: cell.row,
                    col: cell.col,
                    bounds: cell.bounds
                });
            }
        }
    }

    return {
        timeSlices,
        gridDimensions,
        timeRange,
        featuresStatistics,
        heatmaps,
        heatmapBlueprint: {
            cells: Array.from(blueprintCells.values())
        }
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
        
        const cellOffsets: Record<string, {
            contentOffsets: ContentOffsets;
            pages: Record<string, {
                [T in ContentClass]: {
                    offset: number;
                    length: number;
                }
            }>;
        }> = {};

       for (const [cellId, cell] of Object.entries(slice.cells)) {
           // Calculate content offsets
           const contentOffsets = Object.entries(cell.contentIndex).reduce((acc, [className, content]) => {
               if (content.features.length === 0) {
                   return {
                       ...acc,
                       [className]: { offset: 0, length: 0 }  // Zero for empty features
                   };
               }
               
               const encoded = encode(content.features);
               const offset = currentOffset;
               const length = encoded.byteLength;
               currentOffset += length;
               
               return {
                   ...acc,
                   [className]: { offset, length }
               };
           }, {} as ContentOffsets);

            // Calculate page offsets
            const pageOffsets = Object.entries(cell.pages).reduce((acc, [pageNum, page]) => {
                const pageContentOffsets = Object.entries(page).reduce((innerAcc, [className, features]) => {
                    const encoded = encode(features);
                    const offset = currentOffset;
                    const length = encoded.byteLength;
                    currentOffset += length;
                    
                    return {
                        ...innerAcc,
                        [className]: { offset, length }
                    };
                }, {});

                return {
                    ...acc,
                    [pageNum]: pageContentOffsets
                };
            }, {});

            cellOffsets[cellId] = {
                contentOffsets,
                pages: pageOffsets
            };
        }

        timeSliceIndex[period] = {
            offset: sliceStartOffset,
            cells: cellOffsets
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
    for (const [_, slice] of Object.entries(processingResult.timeSlices)) {
        for (const [_, cell] of Object.entries(slice.cells)) {
            // Write content class features
            for (const content of Object.values(cell.contentIndex)) {
                if (content.features.length > 0) {
                    writer.write(encode(content.features));
                }
            }

            // Write paged features
            for (const page of Object.values(cell.pages)) {
                for (const features of Object.values(page)) {
                    if (features.length > 0) {
                        writer.write(encode(features));
                    }
                }
            }
        }
    }

    await writer.end();
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
   console.log("Number of time periods:", Object.keys(metadata.timeSliceIndex).length);
   
   // Print statistics for each content class
   console.log("\nContent Class Statistics:");
   for (const [className, featuresStatistics] of Object.entries(metadata.featuresStatistics.contentClasses)) {
       console.log(`\n${className}:`);
       console.log(`Total features: ${featuresStatistics.total}`);

       if (featuresStatistics.ai) {
           // Print environment featuresStatistics if they exist
           if (featuresStatistics.ai.environment && Object.keys(featuresStatistics.ai.environment).length > 0) {
               console.log("\nEnvironments:");
               Object.entries(featuresStatistics.ai.environment)
                   .sort(([,a], [,b]) => b - a)
                   .forEach(([env, count]) => {
                       console.log(`${env}: ${count}`);
                   });
           }

           // Print top tags if they exist
           if (featuresStatistics.ai.tags && Object.keys(featuresStatistics.ai.tags.tags).length > 0) {
               console.log("\nTop 5 tags:");
               Object.entries(featuresStatistics.ai.tags.tags)
                   .sort(([,a], [,b]) => b - a)
                   .slice(0, 5)
                   .forEach(([tag, count]) => {
                       console.log(`${tag}: ${count}`);
                   });
           }

           // Print top attributes if they exist
           if (featuresStatistics.ai.attributes && Object.keys(featuresStatistics.ai.attributes.tags).length > 0) {
               console.log("\nTop 5 attributes:");
               Object.entries(featuresStatistics.ai.attributes.tags)
                   .sort(([,a], [,b]) => b - a)
                   .slice(0, 5)
                   .forEach(([attr, count]) => {
                       console.log(`${attr}: ${count}`);
                   });
           }
       }
   }

   // Test reading features from first time slice
   const firstPeriod = Object.keys(metadata.timeSliceIndex)[0];
   const firstSlice = metadata.timeSliceIndex[firstPeriod];
   const firstCellId = Object.keys(firstSlice.cells)[0];
   
   if (firstCellId) {
       console.log("\nReading features from first cell:", firstCellId);
       const cellData = firstSlice.cells[firstCellId];

       // Try reading each content class
       for (const contentClass of ['Image', 'Event'] as ContentClass[]) {
           const contentOffset = cellData.contentOffsets[contentClass];
           console.log(`\n${contentClass} features:`);
           console.log(`Offset: ${contentOffset.offset}, Length: ${contentOffset.length}`);
           
           if (contentOffset.length === 0) {
               console.log(`No ${contentClass} features found`);
               continue;
           }

           try {
               const featureBytes = new Uint8Array(
                   buffer, 
                   4 + metadataSize + contentOffset.offset, 
                   contentOffset.length
               );
               const features = decode(featureBytes) as GeoFeatures[];
               
               console.log(`Found ${features.length} ${contentClass} features`);
               if (features.length > 0) {
                   console.log("First feature title:", features[0].properties.title);
                   console.log("First feature date:", features[0].properties.start_date);
                   
                   // Print AI info if it exists
                   if (features[0].properties.ai) {
                       const ai = features[0].properties.ai;
                       if (ai.environment) console.log("Environment:", ai.environment);
                       if (ai.tags) console.log("Tags:", ai.tags);
                       if (ai.attributes) console.log("Attributes:", ai.attributes);
                   }
               }
           } catch (error) {
               console.error(`Error reading ${contentClass} features:`, error);
           }
       }
   }

   console.log("\nTotal features:", metadata.featuresStatistics.totalFeatures);
}

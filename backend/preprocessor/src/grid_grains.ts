import { readdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import JSONStream from 'jsonstream';
import { decode, encode } from '@msgpack/msgpack';
import * as fs from 'node:fs/promises';

import type { 
   Point2D,
   GeoFeature,
   GeoFeatures,
   GridConfig,
   GridDimensions,
   GridCellBounds,
   //BinaryMetadata,
   CellPages,
   //TimeSliceIndex,
   TimeSliceFeatures,
   //HeatmapCell,
   HeatmapBlueprintCell,
   //Heatmap,
   ContentClass,
} from '@atm/shared-types';


type CellContentIndex = {
    [T in ContentClass]: {
        features: GeoFeature<T>[];
        count: number;
    }
};



type ContentFeatures = {
    [T in ContentClass]: {
        features: GeoFeature<T>[];
        count: number;
    }
};



interface TimeSliceIndex {
    offset: number;
    cells: {
        [cellId: string]: {
            contentOffsets: ContentOffsets;
            pages: {
                [pageNum: string]: {
                    [T in ContentClass]: {
                        offset: number;
                        length: number;
                    }
                }
            }
        }
    }
}

interface TimeSlice {
    cells: {
        [cellId: string]: {
            count: number;
            contentIndex: ContentFeatures;
            pages: {
                [pageNum: string]: {
                    [T in ContentClass]: GeoFeature<T>[];
                }
            }
        }
    }
}

type ContentOffsets = {
    [T in ContentClass]: {
        offset: number;
        length: number;
    }
};

type ContentClassPage = {
    [K in ContentClass]: GeoFeature<K>[];
}

interface HeatmapCell {
    cellId: string;
    row: number;
    col: number;
    counts: {
        [T in ContentClass | 'total']: number;
    };
    densities: {
        [T in ContentClass | 'total']: number;
    };
    bounds: GridCellBounds;
}

interface Heatmap {
    period: string;
    cells: HeatmapCell[];
}

type CellData = {
    count: number;
    contentIndex: CellContentIndex;
    pages: {
        [pageNum: string]: ContentClassPage;
    };
}

export interface BinaryMetadata {
    dimensions: GridDimensions;
    timeRange: {
        start: string;
        end: string;
    };
    timeSliceIndex: {
        [period: string]: TimeSliceIndex;
    };
    heatmaps: Record<string, Heatmap>;
    heatmapBlueprint: {
        cells: HeatmapBlueprintCell[];
    };
}


interface ProcessingOptions {
    sliceYears: number;
    pageSize: number;
}


interface ProcessingResult {
    gridDimensions: GridDimensions;
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
        const maxCounts = contentClasses.reduce((acc, content_class) => ({
            ...acc,
            [content_class]: Math.max(
                ...Object.values(slice.cells)
                    .map(cell => cell.contentIndex[content_class].count)
            )
        }), {} as Record<ContentClass, number>);

        const maxTotal = Math.max(
            ...Object.values(slice.cells)
                .map(cell => cell.count)
        );

        // Calculate log-scaled max values
        const maxTransformed = {
            ...contentClasses.reduce((acc, cls) => ({
                ...acc,
                [cls]: Math.log(maxCounts[cls] + 1)
            }), {}),
            total: Math.log(maxTotal + 1)
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
                    [cls]: Math.log(counts[cls] + 1) / maxTransformed[cls]
                }), {}),
                total: Math.log(counts.total + 1) / maxTransformed.total
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

import { decode } from '@msgpack/msgpack';
import type { 
    GeoFeatures, 
    BinaryMetadata, 
    HeatmapResponse, 
    MetadataResponse, 
    CellFeaturesResponse,
    ContentClass,
    Heatmap
} from '@atm/shared-types';

export type ApiHandler = (req: Request) => Promise<Response>;

function jsonResponse(data: unknown, status = 200) {
    // Convert TypedArrays to regular arrays for proper JSON serialization
    const serializedData = JSON.stringify(data, (key, value) => {
        // Check if value is a TypedArray (like Float32Array)
        if (value && value.constructor && value.constructor.name.includes('Array') && value.constructor !== Array) {
            return Array.from(value);
        }
        return value;
    });
    
    return new Response(serializedData, {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
        }
    });
}

function errorResponse(message: string, status = 400) {
    return jsonResponse({ error: message }, status);
}

export class GridApi {
    private binaryBuffer: ArrayBufferLike | null = null;
    private metadata: BinaryMetadata | null = null;
    private dataStartOffset: number = 0;

    constructor(private binaryPath: string) {}

    async initialize() {
        try {
            if (!this.binaryBuffer) {
                console.log("Opening binary file...");
                const mmap = Bun.mmap(this.binaryPath);
                const buffer = mmap.buffer as ArrayBufferLike;
                this.binaryBuffer = buffer;
                
                console.log("Buffer size:", buffer.byteLength);
                
                if (buffer.byteLength < 4) {
                    throw new Error("Binary file too small - missing metadata size");
                }

                const dataView = new DataView(buffer);
                const metadataSize = dataView.getUint32(0, false);
                console.log("Metadata size from binary:", metadataSize);
                
                if (buffer.byteLength < 4 + metadataSize) {
                    throw new Error(`Binary file truncated. Expected ${4 + metadataSize} bytes, got ${buffer.byteLength}`);
                }

                try {
                    const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
                    this.metadata = decode(metadataBytes) as BinaryMetadata;
                    this.dataStartOffset = 4 + metadataSize;
                    
                    console.log("Successfully decoded metadata");
                    console.log("Data start offset:", this.dataStartOffset);
                    console.log("Number of periods:", Object.keys(this.metadata.timeSliceIndex).length);
                    console.log("Number of heatmaps:", Object.keys(this.metadata.heatmaps).length);
                } catch (error) {
                    console.error("Failed to decode metadata:", error);
                    throw error;
                }
            }
        } catch (error) {
            console.error("Failed to initialize binary data:", error);
            throw error;
        }
    }

    getMetadata: ApiHandler = async () => {
        if (!this.metadata) {
            return errorResponse("Metadata not initialized", 500);
        }

        return jsonResponse({
            dimensions: this.metadata.dimensions,
            timeRange: this.metadata.timeRange,
            heatmaps: this.metadata.heatmaps,
            heatmapBlueprint: this.metadata.heatmapBlueprint,
            featuresStatistics: this.metadata.featuresStatistics
        } as MetadataResponse);
    }

    getHeatmap: ApiHandler = async (req) => {
        if (!this.metadata) {
            return errorResponse("Metadata not initialized", 500);
        }

        const url = new URL(req.url);
        const period = url.searchParams.get('period');
        const contentClasses = url.searchParams.get('contentClasses')?.split(',') as ContentClass[] || [];
        const tags = url.searchParams.get('tags')?.split(',') || [];

        const periods = Object.keys(this.metadata.heatmaps);

        // No heatmaps available
        if (periods.length === 0) {
            return errorResponse("No heatmaps available", 404);
        }

        // If period not specified or invalid, return first period's heatmap
        const targetPeriod = !period || !this.metadata.heatmaps[period] 
            ? periods[0] 
            : period;

            try {
                let heatmap: Heatmap;

                // If no content classes specified, return first content class's heatmap
                if (contentClasses.length === 0) {
                    const firstContentClass = Object.keys(this.metadata.heatmaps[targetPeriod].contentClasses)[0] as ContentClass;
                    heatmap = this.metadata.heatmaps[targetPeriod].contentClasses[firstContentClass].base;
                } else {
                    // If multiple content classes or tags specified, combine heatmaps
                    heatmap = this.combineHeatmaps(targetPeriod, contentClasses, tags);
                }

                return jsonResponse({
                    heatmap: heatmap,
                    timeRange: this.metadata.timeRange,
                    availablePeriods: periods
                });
            } catch (error) {
                console.error("Error generating heatmap:", error);
                return errorResponse(`Error generating heatmap: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
            }
    }

    getCellFeatures: ApiHandler = async (req) => {
        /**
         * Retrieves features for a specific cell, supporting filtering by content class and tags
         * 
         * Direct feature access when:
         * - Single content class is queried (uses contentOffsets)
         * - Single content class + single tag is queried (uses contentTagOffsets)
         * 
         * Aggregates features when:
         * - Multiple content classes are selected
         * - Multiple tags are selected
         * - No content class specified (uses pagination)
         * 
         * @param req Request object with:
         *   - cellId: from URL path
         *   - period: query param (required)
         *   - page: query param (default: 1)
         *   - contentClasses: query param (optional)
         *   - tags: query param (optional)
         * 
         * @returns {CellFeaturesResponse}
         * @throws 400 if period missing
         * @throws 404 if period not found or page not found
         * @throws 500 if internal error occurs
         */
        if (!this.metadata) {
            return errorResponse("Metadata not initialized", 500);
        }

        const url = new URL(req.url);
        const cellId = url.pathname.slice('/grid/cell/'.length);
        const period = url.searchParams.get('period');
        const page = parseInt(url.searchParams.get('page') ?? '1');
        const contentClasses = url.searchParams.get('contentClasses')?.split(',') as ContentClass[] || [];
        const tags = url.searchParams.get('tags')?.split(',') || [];

        if (!period) {
            return errorResponse("Period parameter is required", 400);
        }

        try {
            if (!this.metadata?.timeSliceIndex[period]) {
                return errorResponse("Time period not found", 404);
            }

            const timeSlice = this.metadata.timeSliceIndex[period];
            const cell = timeSlice.cells[cellId];

            if (!cell) {
                return jsonResponse({
                    cellId,
                    period,
                    features: [],
                    featureCount: 0,
                    currentPage: 1,
                    totalPages: 0
                });
            }

            let features: GeoFeatures[] = [];

            // If content classes are specified, fetch features by content class and tags
            if (contentClasses.length > 0) {
                // If we're only querying one content class with no tags, we can use direct assignment
                if (contentClasses.length === 1 && tags.length === 0) {
                    const contentClass = contentClasses[0];
                    if (!cell.contentOffsets[contentClass] || cell.contentOffsets[contentClass].length === 0) {
                        features = []; // Empty array if no features found
                    } else {
                        const contentOffset = cell.contentOffsets[contentClass];
                        const contentFeaturesBytes = new Uint8Array(
                            this.binaryBuffer!,
                            this.dataStartOffset + contentOffset.offset,
                            contentOffset.length
                        );
                        features = decode(contentFeaturesBytes) as GeoFeatures[];
                    }
                }
                // If we're only querying one content class with one tag, still use direct assignment
                else if (contentClasses.length === 1 && tags.length === 1) {
                    const contentClass = contentClasses[0];
                    const tag = tags[0];
                    if (cell.contentTagOffsets[contentClass]?.[tag] && 
                        cell.contentTagOffsets[contentClass][tag].length > 0) {
                        const tagOffset = cell.contentTagOffsets[contentClass][tag];
                    const taggedFeaturesBytes = new Uint8Array(
                        this.binaryBuffer!,
                        this.dataStartOffset + tagOffset.offset,
                        tagOffset.length
                    );
                    features = decode(taggedFeaturesBytes) as GeoFeatures[];
                    } else {
                        features = []; // Empty array if no features found
                    }
                }
                // For multiple content classes or tags, we need to accumulate features
                else {
                    for (const contentClass of contentClasses) {
                        if (!cell.contentOffsets[contentClass] || cell.contentOffsets[contentClass].length === 0) {
                            continue;
                        }

                        if (tags.length > 0) {
                            for (const tag of tags) {
                                if (cell.contentTagOffsets[contentClass]?.[tag]) {
                                    const tagOffset = cell.contentTagOffsets[contentClass][tag];

                                    if (tagOffset.length > 0) {
                                        const taggedFeaturesBytes = new Uint8Array(
                                            this.binaryBuffer!,
                                            this.dataStartOffset + tagOffset.offset,
                                            tagOffset.length
                                        );

                                        const taggedFeatures = decode(taggedFeaturesBytes) as GeoFeatures[];
                                        features.push(...taggedFeatures);
                                    }
                                }
                            }
                        } else {
                            const contentOffset = cell.contentOffsets[contentClass];

                            if (contentOffset.length > 0) {
                                const contentFeaturesBytes = new Uint8Array(
                                    this.binaryBuffer!,
                                    this.dataStartOffset + contentOffset.offset,
                                    contentOffset.length
                                );

                                const contentFeatures = decode(contentFeaturesBytes) as GeoFeatures[];
                                features.push(...contentFeatures);
                            }
                        }
                    }
                }
            } else {
                // No content classes specified, use pagination
                const pageKey = `page${page}`;

                // Check if the requested page exists
                if (page > 1 && !cell.pages[pageKey]) {
                    return errorResponse("Page not found", 404);
                }

                const pageLocation = cell.pages[pageKey];
                if (pageLocation) {
                    for (const contentClass of Object.keys(pageLocation) as ContentClass[]) {
                        const contentOffset = pageLocation[contentClass];

                        if (contentOffset.length > 0) {
                            const contentFeaturesBytes = new Uint8Array(
                                this.binaryBuffer!,
                                this.dataStartOffset + contentOffset.offset,
                                contentOffset.length
                            );

                            const contentFeatures = decode(contentFeaturesBytes) as GeoFeatures[];
                            features.push(...contentFeatures);
                        }
                    }
                }
            }

            // Remove duplicates if needed
            const uniqueFeatures = this.removeDuplicateFeatures(features);

        return jsonResponse({
            cellId,
            period,
            features: uniqueFeatures,
            featureCount: uniqueFeatures.length,
            currentPage: page,
            totalPages: Object.keys(cell.pages).length
        } as CellFeaturesResponse);

        } catch (error) {
            console.error("Error serving cell data:", error);
            return errorResponse("Internal server error", 500);
        }
    }
    
    private combineHeatmaps(
        period: string,
        contentClasses: ContentClass[],
        tags: string[]
    ): Heatmap {
        if (!this.metadata) {
            throw new Error("Metadata not initialized");
        }

        const periodHeatmap = this.metadata.heatmaps[period];
        if (!periodHeatmap) {
            // Return empty heatmap for non-existent period
            return this.createEmptyHeatmap();
        }

        // If no content classes specified, return empty heatmap
        if (contentClasses.length === 0) {
            return this.createEmptyHeatmap();
        }

        // Get all relevant heatmaps (filter out invalid content classes)
        const heatmapsToMerge: Heatmap[] = [];

        for (const contentClass of contentClasses) {
            // Skip invalid content classes instead of throwing an error
            if (!periodHeatmap.contentClasses[contentClass]) {
                console.warn(`Content class "${contentClass}" not found in period ${period}`);
                continue;
            }

            if (tags.length === 0) {
                // If no tags, use base heatmap for this content class
                heatmapsToMerge.push(periodHeatmap.contentClasses[contentClass].base);
            } else {
                // If tags specified, use tag heatmaps (only those that exist)
                for (const tag of tags) {
                    if (periodHeatmap.contentClasses[contentClass].tags[tag]) {
                        heatmapsToMerge.push(periodHeatmap.contentClasses[contentClass].tags[tag]);
                    }
                }
            }
        }

        // If no heatmaps to merge, return empty heatmap
        if (heatmapsToMerge.length === 0) {
            return this.createEmptyHeatmap();
        }

        // Merge heatmaps
        return this.mergeHeatmaps(heatmapsToMerge);
    }    
    private mergeHeatmaps(heatmaps: Heatmap[]): Heatmap {
        if (heatmaps.length === 0) {
            return this.createEmptyHeatmap();
        }
        
        if (heatmaps.length === 1) {
            return heatmaps[0];
        }
        
        const firstHeatmap = heatmaps[0];
        const length = firstHeatmap.countArray.length;
        
        const resultCount = new Float32Array(length);
        
        // Sum count arrays
        for (const heatmap of heatmaps) {
            for (let i = 0; i < length; i++) {
                resultCount[i] += heatmap.countArray[i];
            }
        }
        
        // Calculate density using log normalization
        const maxCount = Math.max(...resultCount);
        const resultDensity = new Float32Array(length);
        
        if (maxCount > 0) {
            const maxTransformed = Math.log(maxCount + 1);
            for (let i = 0; i < length; i++) {
                resultDensity[i] = resultCount[i] > 0 ? 
                    Math.log(resultCount[i] + 1) / maxTransformed : 0;
            }
        }
        
        return {
            countArray: resultCount,
            densityArray: resultDensity
        };
    }
    
    private createEmptyHeatmap(): Heatmap {
        // Create empty heatmap with size based on blueprint
        const rows = this.metadata?.heatmapBlueprint.rows || 0;
        const cols = this.metadata?.heatmapBlueprint.cols || 0;
        const length = rows * cols;
        
        return {
            countArray: new Float32Array(length),
            densityArray: new Float32Array(length)
        };
    }
    
    private removeDuplicateFeatures(features: GeoFeatures[]): GeoFeatures[] {
        // This assumes each feature has a unique combination of properties that can be used to identify it
        const seen = new Set<string>();
        const uniqueFeatures: GeoFeatures[] = [];
        
        for (const feature of features) {
            // Create a unique identifier for this feature
            // Here we use content_class + title + start_date as a simple identifier
            const id = `${feature.content_class}_${feature.properties.title}_${feature.properties.start_date}`;
            
            if (!seen.has(id)) {
                seen.add(id);
                uniqueFeatures.push(feature);
            }
        }
        
        return uniqueFeatures;
    }
}

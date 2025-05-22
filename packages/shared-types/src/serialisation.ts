import { GeoFeature, GeoFeatures, ContentClass } from "./geo";
import type { GridDimensions, Heatmap, Heatmaps, HistogramStack, HeatmapBlueprint  } from "./visualisation";


export type CellContentIndex = {
    [T in ContentClass]: {
        features: GeoFeature<T>[];
        count: number;
    }
};



export type CellData = {
    count: number;
    contentIndex: CellContentIndex;
    pages: {
        [pageNum: string]: ContentClassPage;
    };
}

export interface TagStats {
    total: number;
    tags: {
        [tagName: string]: number;
    };
}

export interface AiStats {
    environment?: {
        [envType: string]: number;
    };
    tags?: TagStats;
    attributes?: TagStats;
}

export interface ContentClassStats {
    total: number;
    ai?: AiStats; 
}


export interface CellPages {
    [pageNum: string]: {
        offset: number;
        length: number;
    }
}

export interface BinaryCellIndex {
    startOffset: number;
    endOffset: number;
    featureCount: number;

}
export type ContentFeatures = {
    [T in ContentClass]: {
        features: GeoFeature<T>[];
        count: number;
    }
}

export type ContentOffsets = {
    [T in ContentClass]: {
        offset: number;
        length: number;
    }
}

export type ContentTagOffsets = {
    [T in ContentClass]: {
        [tagName: string]: {
            offset: number;
            length: number;
        }
    }
}

export type ContentClassPage = {
    [K in ContentClass]: GeoFeature<K>[];
}

export interface TimeSliceIndex {
    offset: number;
    cells: {
        [cellId: string]: {
            contentOffsets: ContentOffsets;
            contentTagOffsets: ContentTagOffsets;
            pages: {
                [pageNum: string]: {
                    [T in ContentClass]: {
                        offset: number;
                        length: number;
                    }
                }
            };
            // Add this to support content-class specific pagination
            contentPages: {
                [T in ContentClass]: {
                    [pageNum: string]: {
                        offset: number;
                        length: number;
                    }
                }
            }
        }
    }
}

export interface TimeSlice {
    cells: {
        [cellId: string]: {
            count: number;
            // Add content-specific counts
            contentClassCounts: {
                [T in ContentClass]: number;
            };
            contentIndex: ContentFeatures;
            // Change here: structure now reflects content-class separation
            contentPages: {
                [T in ContentClass]: {
                    [pageNum: string]: ContentClassPage;
                }
            };
            // Keep the original pages structure for backward compatibility if needed
            pages: {
                [pageNum: string]: ContentClassPage;
            }
        }
    }
}

export interface BinaryMetadata {
    dimensions: GridDimensions;
    timeRange: {
        start: string;
        end: string;
    };
    timePeriods: string[]; 
    timeSliceIndex: {
        [period: string]: TimeSliceIndex;
    };
    heatmaps: Heatmaps;
    heatmapBlueprint: HeatmapBlueprint;
    histogram: HistogramStack; // Add this back
    featuresStatistics: {
        contentClasses: {
            [K in ContentClass]: ContentClassStats;
        };
        totalFeatures: number;
    };
}

//interface BinaryFileStructure {
//    // Header - Size of metadata (4 bytes)
//    metadataSize: number;
//    
//    // Metadata section
//    metadata: BinaryMetadata;
//    
//    // Feature data section - all binary blobs referenced by offsets in the metadata
//    featureData: {
//        // Content class features (referenced by contentOffsets)
//        contentClassFeatures: Array<Uint8Array>;
//        
//        // Content class + tag features (referenced by contentTagOffsets)
//        contentTagFeatures: Array<Uint8Array>;
//        
//        // Paginated features (referenced by page offsets)
//        pageFeatures: Array<Uint8Array>;
//    };
//}


// api 

export interface MetadataResponse extends Pick<BinaryMetadata, 'dimensions' | 'timeRange'  | 'heatmapBlueprint' | 'featuresStatistics'> { timePeriods: string[] }

export interface CellFeaturesResponse {
    cellId: string;
    currentPage: number;
    totalPages: number;
    featureCount: number;
    period: string;
    features: GeoFeatures[];
}

export interface HeatmapResponse {
    heatmap: Heatmap;
    timeRange: {
        start: string;
        end: string;
    };
    availablePeriods: string[];
}


export interface HeatmapsResponse {
    heatmaps: Record<string, Heatmap>;  // period -> heatmap
    timeRange: {
        start: string;
        end: string;
    };
    availablePeriods: string[];
}


export interface HistogramResponse {
    histogram: HistogramStack;
    timeRange: {
        start: string;
        end: string;
    };
    availablePeriods: string[];
}

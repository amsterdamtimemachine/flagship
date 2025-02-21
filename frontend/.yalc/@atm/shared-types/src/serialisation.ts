import { GeoFeature, GeoFeatures, ContentClass } from "./geo";
import type { GridDimensions, Heatmap, HeatmapBlueprintCell } from "./visualisation";


export type CellContentIndex = {
    [T in ContentClass]: {
        features: GeoFeature<T>[];
        count: number;
    }
};



export type ContentFeatures = {
    [T in ContentClass]: {
        features: GeoFeature<T>[];
        count: number;
    }
};

export interface TimeSliceIndex {
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

export interface TimeSlice {
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

export type ContentOffsets = {
    [T in ContentClass]: {
        offset: number;
        length: number;
    }
};

export type ContentClassPage = {
    [K in ContentClass]: GeoFeature<K>[];
}

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
    featuresStatistics: {
        contentClasses: {
            [K in ContentClass]: ContentClassStats;
        };
        totalFeatures: number;
    };
}

// api 

export interface MetadataResponse extends Pick<BinaryMetadata, 'dimensions' | 'timeRange' | 'heatmaps' | 'heatmapBlueprint' | 'featuresStatistics'> {}


export interface CellFeaturesResponse {
    cellId: string;
    currentPage: number;   
    totalPages: number;    
    featureCount: number;
    period: string;
    features: GeoFeatures[];

}

// this is only necessary for the /heatmap api endpoint
// delete this if if the /heatmap isn't used
export interface HeatmapResponse extends Heatmap {
    heatmap: Heatmap,
    timeRange: {
        start: string;
        end: string;
    };
    availablePeriods: string[];
}


import { GeoFeature } from "./geo";
import type { GridDimensions, Heatmap, HeatmapBlueprintCell } from "./visualisation";

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


export interface CellPages {
    [pageNum: string]: {
        offset: number;
        length: number;
    }
}

export interface TimeSliceIndex {
    offset: number;
    pages: {
        [cellId: string]: CellPages;
    };
}

export interface TimeSliceFeatures {
    cells: {
        [cellId: string]: {
            count: number;
            pages: {
                [pageNum: string]: GeoFeature[]
            }
        }
    }
}

export interface BinaryCellIndex {
    startOffset: number;
    endOffset: number;
    featureCount: number;

}

export interface MetadataResponse extends Pick<BinaryMetadata, 'dimensions' | 'timeRange' | 'heatmaps' | 'heatmapBlueprint'> {}

export interface CellFeaturesResponse {
    cellId: string;
    period: string;
    features: GeoFeature[];
    featureCount: number;
    currentPage: number;   // New: which page this is
    totalPages: number;    // New: total number of pages for this cell
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


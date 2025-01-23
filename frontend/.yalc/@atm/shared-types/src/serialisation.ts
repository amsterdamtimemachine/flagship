import { GeoFeature } from "./geo";
import type { GridDimensions, Heatmap } from "./visualisation";

export interface BinaryCellIndex {
    startOffset: number;
    endOffset: number;
    featureCount: number;

}

// Binary file metadata structure
export interface BinaryMetadata {
    dimensions: GridDimensions;
    timeRange: {
        start: string;
        end: string;
    };
    timeSliceIndex: {
        [period: string]: TimeSliceIndex;
    };
    heatmaps: {
        [period: string]: Heatmap;
    };
}

export interface TimeSliceIndex {
    offset: number;
    length: number;
}

export interface TimeSliceFeatures {
    cells: {
        [cellId: string]: {
            features: GeoFeature[];
            count: number;
        };
    };
}

export interface CellFeatures {
    features: GeoFeature[];
    count: number;
}

export interface MetadataResponse extends Pick<BinaryMetadata, 'dimensions' | 'timeRange' | 'heatmaps'> {}

export interface CellFeaturesResponse {
    cellId: string;
    period: string;
    features: GeoFeature[];
    featureCount: number;
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


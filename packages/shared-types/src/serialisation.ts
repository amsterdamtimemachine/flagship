import type { GridDimensions, Heatmap } from "./visualisation";

export interface BinaryCellIndex {
    startOffset: number;
    endOffset: number;
    featureCount: number;

}

export interface BinaryMetadata {
    dimensions: GridDimensions;
    cellIndices: Record<string, BinaryCellIndex>;
    timeRange: {
        start: string;
        end: string;
    };
    heatmaps: Heatmap[];
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

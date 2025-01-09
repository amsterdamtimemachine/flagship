import type { GridDimensions, Heatmap } from "./visualisation";

export interface BinaryCellIndex {
    startOffset: number;
    endOffset: number;
    featureCount: number;

}

export interface BinaryMetadata {
    dimensions: GridDimensions;
    cellIndices: Record<string, BinaryCellIndex>;
    heatmap: Heatmap;
}

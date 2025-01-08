import type { GridDimensions } from "./visualisation";

export type BinaryCellIndex = {
    startOffset: number;
    endOffset: number;
    featureCount: number;
}

export type BinaryMetadata = {
    dimensions: GridDimensions;
    cellIndices: Record<string, BinaryCellIndex>;
}

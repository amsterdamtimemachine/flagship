import type { GridDimensions } from "./visualisation";

export type BinaryCellIndex = {
    startOffset: number;
    endOffset: number;
    featureCount: number;
}

export type BinaryMetadata = {
    version: number;
    dimensions: GridDimensions;
    cellIndices: Record<string, BinaryCellIndex>;
}

import type { GridDimensions, BinaryCellIndex } from '@atm/shared-types';

export interface HeatmapCell {
    cellId: string;
    row: number;
    col: number;
    featureCount: number;
}

export interface HeatmapResponse {
    dimensions: GridDimensions;
    cells: HeatmapCell[];
}

export function generateHeatmapData(
    dimensions: GridDimensions,
    cellIndices: Record<string, BinaryCellIndex>
): HeatmapResponse {
    const cells: HeatmapCell[] = [];


    for (let row = 0; row < dimensions.rowsAmount; row++) {
        for (let col = 0; col < dimensions.colsAmount; col++) {
            const cellId = `${row}_${col}`;
            const cellData = cellIndices[cellId];
            const featureCount = cellData?.featureCount ?? 0;

            cells.push({
                cellId,
                row,
                col,
                featureCount
            });
        }
    }

    return {
        dimensions,
        cells,
    };
}

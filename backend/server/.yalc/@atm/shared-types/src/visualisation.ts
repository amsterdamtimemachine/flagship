import { type ContentClass } from './geo';

export interface GridConfig {
    colsAmount: number;
    rowsAmount: number;
    padding: number; 
}


export interface GridDimensions {
    colsAmount: number;
    rowsAmount: number;
    cellWidth: number;
    cellHeight: number;
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
}

export interface GridCellBounds {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
}

export interface GridCellCount {
    cellId: string;
    count: number;
    bounds: GridCellBounds;
}

export interface Grid {
    cellCounts: Map<string, number>;
    entityGridIndices: Map<string, string>;
    dimensions: GridDimensions;
}

export interface HeatmapCell {
    cellId: string;
    row: number;
    col: number;
    counts: {
        [T in ContentClass | 'total']: number;
    };
    densities: {
        [T in ContentClass | 'total']: number;
    };
    bounds: GridCellBounds;
}

export interface HeatmapBlueprintCell extends Pick<HeatmapCell, 'cellId' | 'row' | 'col' | 'bounds' > {}

export interface Heatmap {
    period: string,
    cells: HeatmapCell[];
}


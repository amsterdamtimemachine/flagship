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
    bounds: GridCellBounds;
}

export interface HeatmapBlueprint {
    rows: number;
    cols: number;
    cells: HeatmapCell[];
}

export interface Heatmap {
    densityArray: number[] | Float32Array;
    countArray: number[] | Uint32Array;
}

export interface HeatmapStack {
    contentClasses: {
    [K in ContentClass]: {
            base: Heatmap;
            tags: Heatmap;
           // ai? : {
           //     environment?: Heatmap;
           //     tags?: Heatmap;
           //     attributes?: Heatmap;
           // }            
        }
    };
}

export type Heatmaps = Record<string, HeatmapStack>;


export interface HistogramBin {
    period: string;  // e.g., "1600_1650"
    count: number;   // Total count for this period
    contentCounts: {
        [K in ContentClass]: number;  // Counts per content class
    };
    tagCounts?: {
        [K in ContentClass]: {
            [tagName: string]: number;  // Counts per tag per content class
        };
    };
}

export interface HistogramStack {
    bins: HistogramBin[];
    maxCount: number;  // For normalization
    contentMaxCounts: {
        [K in ContentClass]: number;  // Max counts per content class
    };
}


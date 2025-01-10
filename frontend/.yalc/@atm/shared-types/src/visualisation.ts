export interface GridConfig {
    colsAmount: number;
    rowsAmount: number;
    boundA: [number, number];  
    boundB: [number, number]; 
}

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
    featureCount: number;
    bounds: {
        minLon: number;
        maxLon: number;
        minLat: number;
        maxLat: number;
    };
}

export interface Heatmap {
    period: string,
    cells: HeatmapCell[];
}

export interface HeatmapResponse extends Heatmap {
    dimensions: GridDimensions;
    timeRange: {
        start: string;
        end: string;
    };
    availablePeriods: string[];
}

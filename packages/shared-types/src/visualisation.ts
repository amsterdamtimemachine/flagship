export interface GridConfig {
    colsAmount: number;
    rowsAmount: number;
    boundA: [number, number];  
    boundB: [number, number]; 
}

// Modified GridConfig without bounds
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
    dimensions: GridDimensions;
    cells: HeatmapCell[];
}

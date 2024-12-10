export interface GridConfig {
    width_n: number;
    height_n: number;
    boundA: [number, number];  
    boundB: [number, number]; 
}

export interface GridDimensions {
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

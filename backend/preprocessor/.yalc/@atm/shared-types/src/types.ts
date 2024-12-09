export type TEST = { u : number } 

export interface Point {
    x: number;
    y: number;
}

export interface CellBounds {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
}

export interface CellCount {
    cellId: string;
    count: number;
    bounds: CellBounds;
}

export interface GridConfig {
    width_n: number;
    height_n: number;
    boundA: [number, number];  // [lon, lat]
    boundB: [number, number];  // [lon, lat]
}

export type GeomType = 'polygon' | 'multiline' | 'point' | 'unknown';

export interface GeoData {
    id: string;
    url: string;
    title: string;
    start_date: string;
    end_date: string;
    thumb: string;
    geom: Point[];
    geomType: GeomType;
    centroid?: Point;
}

// src/types/geo.ts - Enhanced ProcessedFeature to match GeoFeatures structure

export type RecordType = 'image' | 'text' | 'event';

// Event-specific properties (for 'event' record type)
export interface EventProperties {
    street_name: string;
    city_name: string;
    info: string;
    venue_type: string;
}

// Image-specific properties (for 'image' record type)
export interface ImageProperties {
    thumb: string;
}

// Type factory for creating properties based on record type
export type PropertiesFor<R extends RecordType> = 
    R extends 'event' ? EventProperties :
    R extends 'image' ? ImageProperties :
    never;


// Geometry types
export type Coordinates = {lon: number, lat: number};


export interface PointGeometry {
    type: "Point";
    coordinates: Coordinates;
}

export interface MultiLineStringGeometry {
    type: "MultiLineString";
    coordinates: Coordinates[][];
    centroid: Coordinates;
}

export interface LineStringGeometry {
    type: "LineString";
    coordinates: Coordinates[];
    centroid: Coordinates;
}

export interface PolygonGeometry {
    type: "Polygon";
    coordinates: Coordinates[][];
    centroid: Coordinates;
}

export type Geometry = PointGeometry | MultiLineStringGeometry | LineStringGeometry | PolygonGeometry;

// Your Amsterdam API feature structure (input format)
export interface RawFeature {
    ds: string;           // Dataset source
    geom: string;         // WKT geometry string
    per: [number, number]; // Time period [start_year, end_year]
    tit: string;          // Title
    url: string;          // Source URL
    recordtype?: RecordType;
    tags?: string[];
}

export interface ProcessedFeature<R extends RecordType = RecordType> {
    title: string;        // From 'tit' field
    dataset: string;      // From 'ds' field
    url: string;
    recordtype: R;        // Now required and typed
    tags: string[];
    
    // Temporal data
    startYear: number;
    endYear: number;
    
    // Spatial data - supports all geometry types
    geometry: Geometry;   // Point, MultiLineString, LineString, or Polygon
    
    // Optional properties using type factory pattern
    properties?: Partial<PropertiesFor<R>>;
}

// Type aliases for convenience
export type ImageFeature = ProcessedFeature<'image'>;
export type EventFeature = ProcessedFeature<'event'>;
export type TextFeature = ProcessedFeature<'text'>;
export type AnyProcessedFeature = ProcessedFeature<RecordType>;


export interface GridCellBounds {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
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

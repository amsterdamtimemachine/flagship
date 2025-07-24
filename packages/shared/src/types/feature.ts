import type { Coordinates } from './spatial';
export type RecordType = 'image' | 'text' | 'person' | 'unknown';


// Your Amsterdam API feature structure (input format)
export interface RawFeature {
    ds: string;           // Dataset source
    geom: string;         // WKT geometry string
    per: [number, number]; // Time period [start_year, end_year]
    tit: string;          // Title
    url: string;          // Source URL
    recordType: RecordType;
    tags?: string[];
}

export interface ImageFeature extends RawFeature {
    thumb: string;
}

export interface TextFeature extends RawFeature {
    text: string;
}

//export interface ProcessedFeature<R extends RecordType = RecordType> {
//    title: string;        // From 'tit' field
//    dataset: string;      // From 'ds' field
//    url: string;
//    recordType: R;        // Now required and typed
//    tags: string[];
//    
//    // Temporal data
//    startYear: number;
//    endYear: number;
//    
//    // Spatial data - supports all geometry types
//    geometry: Geometry;   // Point, MultiLineString, LineString, or Polygon
//    
//    // Optional properties using type factory pattern
//    properties?: Partial<PropertiesFor<R>>;
//}

// feature for optimized discovery processing
// Contains only essential fields needed for accumulator processing
export interface MinimalFeature {
    coordinates: Coordinates;
    recordType: RecordType;
    tags: string[];
    startYear: number;
    endYear: number;
}

// Type aliases for convenience
//export type EventFeature = ProcessedFeature<'person'>;
//export type TextFeature = ProcessedFeature<'text'>;
//export type AnyProcessedFeature = ProcessedFeature<RecordType>;


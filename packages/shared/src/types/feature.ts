export type RecordType = 'image' | 'text' | 'event';

export interface EventProperties {
    street_name: string;
    city_name: string;
    info: string;
    venue_type: string;
}

export interface ImageProperties {
    thumb: string;
}

export type PropertiesFor<R extends RecordType> = 
    R extends 'event' ? EventProperties :
    R extends 'image' ? ImageProperties :
    never;


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


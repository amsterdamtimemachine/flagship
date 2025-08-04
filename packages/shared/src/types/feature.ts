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
    thumbnail: string;
    alt?: string;
}

export interface TextFeature extends RawFeature {
    text: string;
}

export type Feature = ImageFeature | TextFeature;

// feature for optimized discovery processing
// Contains only essential fields needed for accumulator processing
export interface MinimalFeature {
    coordinates: Coordinates;
    recordType: RecordType;
    tags: string[];
    startYear: number;
    endYear: number;
}



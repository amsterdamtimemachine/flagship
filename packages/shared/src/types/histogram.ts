// histogram.ts - Updated histogram types with flattened structure

import type { RecordType } from "./feature";

import type { TimeSlice, TimeRange } from "./temporal";
import type { Bounds } from "./spatial";

/**
 * Single bin representing one time period for a specific filter
 */
export interface HistogramBin {
  timeSlice: TimeSlice;                              
  count: number;                                     
}

/**
 * Histogram for a specific filter combination - FLATTENED STRUCTURE
 * Each histogram is filtered for specific recordTypes/tags
 */
export interface Histogram {
  bins: HistogramBin[];                              
  recordTypes?: RecordType[];                        
  tags?: string[];                                  
  bounds?: Bounds
  maxCount: number;                                  // Highest count across all bins
  timeRange: TimeRange;
  totalFeatures: number;                             // Sum across all periods (moved from metadata)
}

/**
 * Request parameters for histogram generation
 */
export interface HistogramRequest {
  recordTypes?: RecordType[];                        // Filter by record types
  tags?: string[];                                   // Filter by tags (AND logic)
  timeSlices: TimeSlice[];                           // Time periods to include
  bounds?: {                                         // Geographic bounds
    minLon: number;
    maxLon: number; 
    minLat: number;
    maxLat: number;
  };
}

/**
 * Accumulator for building filtered histograms
 */
export interface HistogramAccumulator {
  bins: Map<string, HistogramBin>;                   // timeSliceKey -> bin
  request: HistogramRequest;                         // What we're filtering for
  maxCount: number;                                  // Track max during accumulation
}

/**
 * Collection of histograms for different filters
 * Useful for API responses with multiple histogram variants
 */
export interface HistogramCollection {
  [filterKey: string]: Histogram;                    // e.g., "text_politics", "image_all", etc.
}

/**
 * API response format
 */
export interface HistogramApiResponse {
  histogram: Histogram;
  success: boolean;
  message?: string;
  processingTime?: number;
}

/**
 * Multi-histogram API response (for comparing multiple filters)
 */
export interface MultiHistogramApiResponse {
  histograms: HistogramCollection;
  success: boolean;
  message?: string;
  processingTime?: number;
}

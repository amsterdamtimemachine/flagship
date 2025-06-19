import type { RecordType, RawFeature, AnyProcessedFeature } from './feature'; 
import type { Heatmap } from './heatmap';
import type { Histogram } from './histogram';
import type { TimeRange } from './temporal';

export interface DatabaseConfig {
  baseUrl: string;
  defaultParams?: Partial<ApiQueryParams>;
  batchSize?: number;
  timeout?: number;
}

export interface ApiQueryParams {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  start_year: string;
  end_year: string;
  recordtype?: RecordType;
  limit?: number;
  offset?: number;
}

// response from the DB
export interface ApiResponse {
  data: RawFeature[];
  total: number;
}

// responses from sveltekit server to the frontend
export interface MetadataResponse {
  data: any;
}
// WIP: this needs to be adjusted to reflect actual metadata from the updated api

//extends Pick<BinaryMetadata, 'dimensions' | 'timeRange'  | 'heatmapBlueprint' | 'featuresStatistics'> { timePeriods: string[] }

export interface HeatmapCellResponse {
    cellId: string;
    currentPage: number;
    totalPages: number;
    featureCount: number;
    period: string;
    features: AnyProcessedFeature[];
}


export interface HeatmapResponse {
    heatmap: Heatmap;
    timeRange: TimeRange;
    availablePeriods: string[];
}


export interface HeatmapTimelineResponse {
    heatmaps: Record<string, Heatmap>;  // period -> heatmap
    timeRange: TimeRange
    availablePeriods: string[];
}


export interface HistogramResponse {
    histogram: Histogram;
    timeRange: TimeRange;
    availablePeriods: string[];
}

// export interface MetadataResponse extends Pick<BinaryMetadata, 'dimensions' | 'timeRange'  | 'heatmapBlueprint' | 'featuresStatistics'> { timePeriods: string[] }
// 
// export interface CellFeaturesResponse {
//     cellId: string;
//     currentPage: number;
//     totalPages: number;
//     featureCount: number;
//     period: string;
//     features: GeoFeatures[];
// }
// 
// export interface HeatmapResponse {
//     heatmap: Heatmap;
//     timeRange: {
//         start: string;
//         end: string;
//     };
//     availablePeriods: string[];
// }
// 
// 
// export interface HeatmapsResponse {
//     heatmaps: Record<string, Heatmap>;  // period -> heatmap
//     timeRange: {
//         start: string;
//         end: string;
//     };
//     availablePeriods: string[];
// }
// 
// 
// export interface HistogramResponse {
//     histogram: Histogram;
//     timeRange: {
//         start: string;
//         end: string;
//     };
//     availablePeriods: string[];
// }

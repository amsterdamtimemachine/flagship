import type { RecordType, RawFeature, AnyProcessedFeature } from './feature'; 
import type { HeatmapCellBounds } from './heatmap';

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

export interface ApiResponse {
  data: RawFeature[];
  total: number;
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

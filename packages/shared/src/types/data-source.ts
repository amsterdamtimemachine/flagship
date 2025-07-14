import type { RecordType, RawFeature, AnyProcessedFeature } from './feature'; 
import type { Heatmap, HeatmapTimeline } from './heatmap';
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
  recordtypes?: RecordType[];
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

export interface HeatmapTimelineApiResponse {
  heatmapTimeline: HeatmapTimeline;
  recordTypes: RecordType[];
  tags?: string[];
  resolution: string;
  success: boolean;
  message?: string;
  processingTime?: number;
}

export interface HistogramResponse {
    histogram: Histogram;
    recordTypes: RecordType[];
    tags?: string[];
    timeRange: TimeRange;
    availablePeriods: string[];
}


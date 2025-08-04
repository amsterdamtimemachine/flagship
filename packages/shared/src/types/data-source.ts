import type { RecordType, RawFeature } from './feature'; 
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
  page?: number;
  page_size?: number;
}

// response from the DB
export interface ApiResponse {
  data: RawFeature[];
  total: number;
  page: number;
  page_size: number;
  returned: number;
  total_pages: number;
}

// responses from sveltekit server to the frontend
// WIP gotta finish this
export interface MetadataResponse {
  data: any;
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


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

export interface SpatialChunk {
  id: string;
  bounds: HeatmapCellBounds;
}

export interface ChunkingConfig {
  chunkRows: number;    // e.g., 4 = 4x4 = 16 chunks
  chunkCols: number;
  overlap?: number;     // overlap between chunks in degrees
  delayMs?: number;     // delay between chunk processing
}

export interface ChunkResult {
  chunk: SpatialChunk;
  features: AnyProcessedFeature[];
  stats: {
    totalRaw: number;      // Total features from API
    validProcessed: number; // Successfully converted features
    invalidSkipped: number; // Features skipped due to missing recordtype
  };
}

export interface StreamingOptions {
  timeRange?: { start: string; end: string };
  recordtype?: RecordType; 
}

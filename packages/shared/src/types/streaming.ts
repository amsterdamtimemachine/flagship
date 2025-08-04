import type { HeatmapCellBounds } from './heatmap';
import type { RecordType, MinimalFeature } from './feature';

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
  features: MinimalFeature[];
  stats: {
    totalRaw: number;      // Total features from API
    validProcessed: number; // Successfully converted features
    invalidSkipped: number; // Features skipped due to missing recordtype
  };
}

export interface StreamingOptions {
  timeRange?: { start: string; end: string };
  recordTypes?: RecordType[];
}

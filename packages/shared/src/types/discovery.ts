import type { RecordType, MinimalFeature } from './feature';
import type { ChunkResult, SpatialChunk } from './streaming';
import type { HeatmapAccumulator } from './heatmap';

/**
 * Vocabulary tracking for discovered recordTypes and tags
 */
export interface VocabularyTracker {
  recordTypes: Set<RecordType>;
  tags: Set<string>;
}

/**
 * Result from discovery streaming using minimal features
 */
export interface DiscoveryChunkResult {
  chunk: SpatialChunk;
  features: MinimalFeature[];
  stats: {
    totalRaw: number;
    validProcessed: number;
    invalidSkipped: number;
  };
  vocabulary: VocabularyTracker;
}

/**
 * Enhanced accumulator that includes vocabulary tracking
 */
export interface DiscoveryHeatmapAccumulator extends HeatmapAccumulator {
  vocabulary: VocabularyTracker;
}

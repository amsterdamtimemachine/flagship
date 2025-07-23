import type { RecordType } from './feature';
import type { ChunkResult } from './streaming';
import type { HeatmapAccumulator } from './heatmap';

/**
 * Vocabulary tracking for discovered recordTypes and tags
 */
export interface VocabularyTracker {
  recordTypes: Set<RecordType>;
  tags: Set<string>;
}

/**
 * Result from discovery streaming including vocabulary
 */
export interface DiscoveryChunkResult extends ChunkResult {
  vocabulary: VocabularyTracker;
}

/**
 * Enhanced accumulator that includes vocabulary tracking
 */
export interface DiscoveryHeatmapAccumulator extends HeatmapAccumulator {
  vocabulary: VocabularyTracker;
}

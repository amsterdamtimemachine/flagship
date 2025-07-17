// src/utils/vocabulary_core.ts - Core vocabulary utilities only

import type { VocabularyTracker } from '@atm/shared/types';

/**
 * Export vocabulary to JSON format for serialization
 */
export function exportVocabularyToJSON(vocabulary: VocabularyTracker): string {
  const exportData = {
    recordTypes: Array.from(vocabulary.recordTypes),
    tags: Array.from(vocabulary.tags)
  };
  
  return JSON.stringify(exportData, null, 2);
}

/**
 * Import vocabulary from JSON format
 */
export function importVocabularyFromJSON(json: string): VocabularyTracker {
  const data = JSON.parse(json);
  
  return {
    recordTypes: new Set(data.recordTypes),
    tags: new Set(data.tags)
  };
}
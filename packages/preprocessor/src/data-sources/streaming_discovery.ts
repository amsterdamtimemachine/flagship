// src/data-sources/streaming_discovery.ts - Single-pass vocabulary discovery streaming

import type { 
  DatabaseConfig, 
  RecordType,
  AnyProcessedFeature,
  HeatmapCellBounds,
  SpatialChunk,
  ChunkingConfig,
  ChunkResult,
  StreamingOptions,
  VocabularyTracker,
  DiscoveryChunkResult
} from '@atm/shared/types';
import { fetchBatch, convertRawFeature } from './database';
import { createSpatialChunks } from './streaming';

/**
 * Create empty vocabulary tracker
 */
export function createVocabularyTracker(): VocabularyTracker {
  return {
    recordTypes: new Set<RecordType>(),
    tags: new Set<string>()
  };
}

/**
 * Update vocabulary tracker with a feature
 */
export function updateVocabulary(
  vocabulary: VocabularyTracker, 
  feature: AnyProcessedFeature
): void {
  vocabulary.recordTypes.add(feature.recordType);
  
  const tags = feature.tags || [];
  for (const tag of tags) {
    vocabulary.tags.add(tag);
  }
}

/**
 * Merge two vocabulary trackers
 */
export function mergeVocabularies(
  target: VocabularyTracker, 
  source: VocabularyTracker
): void {
  for (const recordType of source.recordTypes) {
    target.recordTypes.add(recordType);
  }
  
  for (const tag of source.tags) {
    target.tags.add(tag);
  }
}

/**
 * Discovery streaming function - discovers vocabulary while streaming features
 */
export async function* streamFeaturesWithDiscovery(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  options?: StreamingOptions
): AsyncGenerator<DiscoveryChunkResult> {
  
  const chunks = createSpatialChunks(bounds, chunkConfig);
  console.log(`🔍 Discovery streaming ${chunks.length} spatial chunks...`);
  
  let processedChunks = 0;
  const totalChunks = chunks.length;
  let totalStats = { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 };
  let globalVocabulary = createVocabularyTracker();
  
  for (const chunk of chunks) {
    processedChunks++;
    console.log(`📦 Discovery processing chunk ${chunk.id} (${processedChunks}/${totalChunks})...`);
    
    try {
      // Fetch features for this chunk without recordType filtering to discover all types
      const result = await fetchChunkFeaturesWithDiscovery(config, chunk.bounds, options?.timeRange);
      
      // Update total stats
      totalStats.totalRaw += result.stats.totalRaw;
      totalStats.validProcessed += result.stats.validProcessed;
      totalStats.invalidSkipped += result.stats.invalidSkipped;
      
      // Merge vocabulary from this chunk
      mergeVocabularies(globalVocabulary, result.vocabulary);
      
      console.log(`✅ Chunk ${chunk.id}: ${result.features.length} valid features`);
      
      yield {
        chunk,
        features: result.features,
        stats: result.stats,
        vocabulary: result.vocabulary
      };
      
      // Optional: Add delay to prevent API overload
      if (chunkConfig.delayMs && processedChunks < totalChunks) {
        console.log(`⏱️ Waiting ${chunkConfig.delayMs}ms before next chunk...`);
        await new Promise(resolve => setTimeout(resolve, chunkConfig.delayMs));
      }
      
    } catch (error) {
      console.error(`💥 Error processing chunk ${chunk.id}:`, error);
      // Continue with other chunks instead of failing completely
      console.log(`⚠️ Continuing with empty chunk for ${chunk.id}`);
      yield {
        chunk,
        features: [],
        stats: { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 },
        vocabulary: createVocabularyTracker()
      };
    }
  }
  
  console.log(`🎉 Completed discovery processing ${totalChunks} chunks`);
  console.log(`📊 Total stats: ${totalStats.validProcessed}/${totalStats.totalRaw} valid features (${totalStats.invalidSkipped} skipped)`);
}

/**
 * Fetch features for a specific spatial chunk with vocabulary discovery
 */
async function fetchChunkFeaturesWithDiscovery(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  timeRange?: { start: string; end: string }
): Promise<{ features: AnyProcessedFeature[]; stats: ChunkResult['stats']; vocabulary: VocabularyTracker }> {
  console.log(`🔍 Discovery fetching chunk data for bounds:`, {
    lat: [bounds.minLat.toFixed(3), bounds.maxLat.toFixed(3)],
    lon: [bounds.minLon.toFixed(3), bounds.maxLon.toFixed(3)],
    discoveryMode: true
  });
  
  const features: AnyProcessedFeature[] = [];
  let currentPage = 1;
  const pageSize = config.batchSize || 500;
  let hasMore = true;
  let requestCount = 0;
  let stats = { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 };
  let vocabulary = createVocabularyTracker();
  
  while (hasMore) {
    requestCount++;
    
    // Don't filter by recordType - discover all types
    const params = {
      min_lat: bounds.minLat,
      min_lon: bounds.minLon,
      max_lat: bounds.maxLat,
      max_lon: bounds.maxLon,
      start_year: timeRange?.start || '1800-01-01',
      end_year: timeRange?.end || '2024-12-31',
      page: currentPage,
      page_size: pageSize,
      ...config.defaultParams
      // Explicitly no recordtype filter for discovery
    };
    
    try {
      const response = await fetchBatch(config.baseUrl, params);
      
      if (response.data && response.data.length > 0) {
        stats.totalRaw += response.data.length;
        
        // Convert API features to ProcessedFeatures and discover vocabulary
        for (const apiFeature of response.data) {
          try {
            // Try to extract recordType from feature data, or infer from content
            let featureRecordType: RecordType = 'text'; // default fallback
            
            if (apiFeature.recordType) {
              featureRecordType = apiFeature.recordType as RecordType;
            } else if (apiFeature.type) {
              // Map common type fields to our RecordType enum
              switch (apiFeature.type.toLowerCase()) {
                case 'image':
                case 'photo':
                case 'picture':
                  featureRecordType = 'image';
                  break;
                case 'text':
                case 'document':
                case 'article':
                  featureRecordType = 'text';
                  break;
                case 'event':
                case 'happening':
                  featureRecordType = 'event';
                  break;
                default:
                  featureRecordType = 'text';
              }
            } else if (apiFeature.url && (apiFeature.url.includes('.jpg') || apiFeature.url.includes('.png') || apiFeature.url.includes('.jpeg'))) {
              featureRecordType = 'image';
            }
            
            const processedFeature = convertRawFeature(apiFeature, featureRecordType);
            
            // Update vocabulary with discovered feature
            updateVocabulary(vocabulary, processedFeature);
            
            features.push(processedFeature);
            stats.validProcessed++;
          } catch (error) {
            stats.invalidSkipped++;
            console.warn(`⚠️ Skipping feature due to conversion error: ${apiFeature.url}`, error);
          }
        }
      }
      
      hasMore = response.page < response.total_pages;
      currentPage++;
      
      // Safety check per chunk to prevent runaway chunks
      if (features.length > 50000) {
        console.warn(`⚠️ Chunk has ${features.length} features, may need further subdivision`);
        break;
      }
      
    } catch (error) {
      console.error(`❌ Error fetching discovery batch ${requestCount}:`, error);
      throw error;
    }
  }
  
  console.log(`🔍 Discovery chunk complete: ${features.length} valid features in ${requestCount} requests`);
  
  return { features, stats, vocabulary };
}


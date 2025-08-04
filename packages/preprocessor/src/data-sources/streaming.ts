// src/data-sources/streaming.ts - Single-pass vocabulary discovery streaming

import type { 
  DatabaseConfig, 
  RecordType,
  MinimalFeature,
  HeatmapCellBounds,
  SpatialChunk,
  ChunkingConfig,
  ChunkResult,
  StreamingOptions,
  VocabularyTracker,
  DiscoveryChunkResult
} from '@atm/shared/types';
import { fetchBatch, createMinimalFeature } from './database';

/**
 * Create basic spatial chunks from bounds
 */
export function createSpatialChunks(
  bounds: HeatmapCellBounds,
  config: ChunkingConfig
): SpatialChunk[] {
  const chunks: SpatialChunk[] = [];
  
  const lonStep = (bounds.maxLon - bounds.minLon) / config.chunkCols;
  const latStep = (bounds.maxLat - bounds.minLat) / config.chunkRows;
  const overlap = config.overlap || 0;
  
  console.log(`📐 Creating ${config.chunkRows}x${config.chunkCols} grid:`, {
    lonStep: lonStep.toFixed(6),
    latStep: latStep.toFixed(6),
    overlap: overlap
  });
  
  for (let row = 0; row < config.chunkRows; row++) {
    for (let col = 0; col < config.chunkCols; col++) {
      const chunkBounds: HeatmapCellBounds = {
        minLon: Math.max(bounds.minLon + (col * lonStep) - overlap, bounds.minLon),
        maxLon: Math.min(bounds.minLon + ((col + 1) * lonStep) + overlap, bounds.maxLon),
        minLat: Math.max(bounds.minLat + (row * latStep) - overlap, bounds.minLat),
        maxLat: Math.min(bounds.minLat + ((row + 1) * latStep) + overlap, bounds.maxLat)
      };
      
      chunks.push({
        id: `chunk_${row}_${col}`,
        bounds: chunkBounds
      });
    }
  }
  
  console.log(`✅ Created ${chunks.length} spatial chunks`);
  return chunks;
}




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
 * Update vocabulary tracker with a minimal feature
 */
export function updateVocabulary(
  vocabulary: VocabularyTracker, 
  feature: MinimalFeature
): void {
  vocabulary.recordTypes.add(feature.recordType);
  
  for (const tag of feature.tags) {
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
): Promise<{ features: MinimalFeature[]; stats: ChunkResult['stats']; vocabulary: VocabularyTracker }> {
  console.log(`🔍 Discovery fetching chunk data for bounds:`, {
    lat: [bounds.minLat.toFixed(3), bounds.maxLat.toFixed(3)],
    lon: [bounds.minLon.toFixed(3), bounds.maxLon.toFixed(3)],
    discoveryMode: true
  });
  
  const features: MinimalFeature[] = [];
  let currentPage = 1;
  const pageSize = config.batchSize || 500;
  let hasMore = true;
  let requestCount = 0;
  let stats = { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 };
  let vocabulary = createVocabularyTracker();
  
  while (hasMore) {
    requestCount++;
    
    // Don't filter by recordType - discover all types
    console.log(`🔍 DEBUG: config.defaultParams =`, config.defaultParams);
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
    console.log(`🔍 DEBUG: Discovery params =`, params);
    
    try {
      const response = await fetchBatch(config.baseUrl, params);
      
      if (response.data && response.data.length > 0) {
        stats.totalRaw += response.data.length;
        
        // Create minimal features and discover vocabulary
        for (const apiFeature of response.data) {
          try {
            // DEBUG: Log first few features to understand structure
            if (stats.validProcessed < 3) {
              console.log(`🔍 DEBUG: Raw feature structure:`, JSON.stringify(apiFeature, null, 2));
            }
            
            // Only use recordType field, skip features without it
            if (!apiFeature.recordType) {
              stats.invalidSkipped++;
              continue; // Skip features without recordType field
            }
            
            const featureRecordType = apiFeature.recordType as RecordType;
            
            const minimalFeature = createMinimalFeature(apiFeature, featureRecordType);
            
            // Update vocabulary with discovered feature
            updateVocabulary(vocabulary, minimalFeature);
            
            features.push(minimalFeature);
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


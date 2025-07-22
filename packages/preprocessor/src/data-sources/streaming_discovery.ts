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
} from '@atm/shared/types';
import { fetchBatch, convertRawFeature } from './database';
import { createSpatialChunks } from './streaming';


/**
 * Discovery streaming function - streams features without vocabulary tracking
 */
export async function* streamFeaturesWithDiscovery(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  options?: StreamingOptions
): AsyncGenerator<ChunkResult> {
  
  const chunks = createSpatialChunks(bounds, chunkConfig);
  console.log(`🔍 Streaming ${chunks.length} spatial chunks...`);
  
  let processedChunks = 0;
  const totalChunks = chunks.length;
  let totalStats = { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 };
  
  for (const chunk of chunks) {
    processedChunks++;
    console.log(`📦 Processing chunk ${chunk.id} (${processedChunks}/${totalChunks})...`);
    
    try {
      // Fetch features for this chunk without recordType filtering to discover all types
      const result = await fetchChunkFeaturesWithDiscovery(config, chunk.bounds, options?.timeRange);
      
      // Update total stats
      totalStats.totalRaw += result.stats.totalRaw;
      totalStats.validProcessed += result.stats.validProcessed;
      totalStats.invalidSkipped += result.stats.invalidSkipped;
      
      console.log(`✅ Chunk ${chunk.id}: ${result.features.length} valid features`);
      
      yield {
        chunk,
        features: result.features,
        stats: result.stats
      };
      
      if (chunkConfig.delayMs && processedChunks < totalChunks) {
        await new Promise(resolve => setTimeout(resolve, chunkConfig.delayMs));
      }
      
    } catch (error) {
      console.error(`💥 Error processing chunk ${chunk.id}:`, error);
      // Continue with other chunks instead of failing completely
      console.log(`⚠️ Continuing with empty chunk for ${chunk.id}`);
      yield {
        chunk,
        features: [],
        stats: { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 }
      };
    }
  }
  
  console.log(`🎉 Completed discovery processing ${totalChunks} chunks`);
  console.log(`📊 Total stats: ${totalStats.validProcessed}/${totalStats.totalRaw} valid features (${totalStats.invalidSkipped} skipped)`);
}

/**
 * Fetch features for a specific spatial chunk
 */
async function fetchChunkFeaturesWithDiscovery(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  timeRange?: { start: string; end: string }
): Promise<{ features: AnyProcessedFeature[]; stats: ChunkResult['stats'] }> {
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
        
        // Convert API features to ProcessedFeatures
        for (const apiFeature of response.data) {
          try {
          
            // Only use recordType field, skip features without it
            if (!apiFeature.recordType) {
              stats.invalidSkipped++;
              continue; // Skip features without recordType field
            }
            
            const featureRecordType = apiFeature.recordType as RecordType;
            
            const processedFeature = convertRawFeature(apiFeature, featureRecordType);
            
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
  
  return { features, stats };
}


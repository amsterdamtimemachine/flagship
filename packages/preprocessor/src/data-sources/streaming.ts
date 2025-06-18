// src/data-sources/streaming.ts - Updated for new convertRawFeature signature

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


/**
 * Main streaming function - generates chunks and fetches features for each
 */
export async function* streamFeaturesByChunks(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  options?: StreamingOptions
): AsyncGenerator<ChunkResult> {
  
  const chunks = createSpatialChunks(bounds, chunkConfig);
  console.log(`🧩 Processing ${chunks.length} spatial chunks...`);
  
  let processedChunks = 0;
  const totalChunks = chunks.length;
  let totalStats = { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 };
  
  for (const chunk of chunks) {
    processedChunks++;
    console.log(`📦 Processing chunk ${chunk.id} (${processedChunks}/${totalChunks})...`);
    
    try {
      // Fetch features for this chunk
      const result = await fetchChunkFeatures(config, chunk.bounds, options?.timeRange, options?.recordtype);
      
      // Update total stats
      totalStats.totalRaw += result.stats.totalRaw;
      totalStats.validProcessed += result.stats.validProcessed;
      totalStats.invalidSkipped += result.stats.invalidSkipped;
      
      console.log(`✅ Chunk ${chunk.id}: ${result.features.length} valid features (${result.stats.invalidSkipped} skipped)`);
      
      yield {
        chunk,
        features: result.features,
        stats: result.stats
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
        stats: { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 }
      };
    }
  }
  
  console.log(`🎉 Completed processing ${totalChunks} chunks`);
  console.log(`📊 Total stats: ${totalStats.validProcessed}/${totalStats.totalRaw} valid features (${totalStats.invalidSkipped} skipped)`);
}

/**
 * Fetch features for a specific spatial chunk
 */
async function fetchChunkFeatures(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  timeRange?: { start: string; end: string },
  recordtype?: RecordType
): Promise<{ features: AnyProcessedFeature[]; stats: ChunkResult['stats'] }> {
  console.log(`📍 Fetching chunk data for bounds:`, {
    lat: [bounds.minLat.toFixed(3), bounds.maxLat.toFixed(3)],
    lon: [bounds.minLon.toFixed(3), bounds.maxLon.toFixed(3)],
    recordtype: recordtype || 'all'
  });
  
  const features: AnyProcessedFeature[] = [];
  let offset = 0;
  const batchSize = config.batchSize || 500; // Smaller batches for chunks
  let hasMore = true;
  let requestCount = 0;
  let stats = { totalRaw: 0, validProcessed: 0, invalidSkipped: 0 };
  
  while (hasMore) {
    requestCount++;
    
    const params = {
      min_lat: bounds.minLat,
      min_lon: bounds.minLon,
      max_lat: bounds.maxLat,
      max_lon: bounds.maxLon,
      start_year: timeRange?.start || '1800-01-01',
      end_year: timeRange?.end || '2024-12-31',
      limit: batchSize,
      offset: offset,
      ...(recordtype && { recordtype }), // Add recordtype filter if provided
      ...config.defaultParams
    };
    
    try {
      const response = await fetchBatch(config.baseUrl, params);
      
      if (response.data && response.data.length > 0) {
        stats.totalRaw += response.data.length;
        
        // Convert API features to ProcessedFeatures
        for (const apiFeature of response.data) {
          try {
            // Use the queried recordtype or default to 'text'
            const featureRecordType = recordtype || 'text';
            const processedFeature = convertRawFeature(apiFeature, featureRecordType);
            
            features.push(processedFeature);
            stats.validProcessed++;
          } catch (error) {
            stats.invalidSkipped++;
            console.warn(`⚠️ Skipping feature due to conversion error: ${apiFeature.url}`, error);
          }
        }
      }
      
      hasMore = response.data && response.data.length === batchSize;
      offset += batchSize;
      
      // Safety check per chunk to prevent runaway chunks
      if (features.length > 50000) {
        console.warn(`⚠️ Chunk has ${features.length} features, may need further subdivision`);
        break;
      }
      
    } catch (error) {
      console.error(`❌ Error fetching chunk batch ${requestCount}:`, error);
      throw error;
    }
  }
  
  console.log(`📦 Chunk complete: ${features.length} valid features in ${requestCount} requests`);
  return { features, stats };
}

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

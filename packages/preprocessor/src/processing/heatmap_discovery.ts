// src/processing/heatmap_discovery.ts - Dynamic heatmap generation with vocabulary discovery

import type { 
  RecordType, 
  AnyProcessedFeature, 
  HeatmapDimensions, 
  Coordinates, 
  DatabaseConfig,
  ChunkingConfig,
  Heatmap,
  HeatmapTimeline,
  HeatmapResolutions,
  HeatmapResolutionConfig,
  HeatmapCellBounds,
  HeatmapAccumulator,
  TimeSlice,
  VocabularyTracker,
  DiscoveryChunkResult,
  DiscoveryHeatmapAccumulator
} from '@atm/shared/types';
import { 
  streamFeaturesWithDiscovery, 
  createVocabularyTracker, 
  mergeVocabularies
} from '../data-sources/streaming_discovery';
import { 
  getFeatureCoordinates, 
  getCellIdForCoordinates, 
  generateHeatmap 
} from './heatmap';

/**
 * Create empty discovery accumulator
 */
export function createDiscoveryHeatmapAccumulator(heatmapDimensions: HeatmapDimensions): DiscoveryHeatmapAccumulator {
  return {
    cellCounts: {
      base: new Map(),
      tags: new Map()
    },
    heatmapDimensions: heatmapDimensions,
    collectedTags: new Set(),
    vocabulary: createVocabularyTracker()
  };
}

/**
 * Process a single feature into the discovery accumulator
 */
export function processFeatureIntoDiscoveryCounts(
  feature: AnyProcessedFeature,
  accumulator: DiscoveryHeatmapAccumulator
): void {
  // Get cell position
  const coordinates = getFeatureCoordinates(feature);
  const cellId = getCellIdForCoordinates(coordinates, accumulator.heatmapDimensions);
  
  if (!cellId) return; // Feature outside grid bounds
  
  const recordType = feature.recordType;
  
  // Track in vocabulary
  accumulator.vocabulary.recordTypes.add(recordType);
  
  // Initialize base counts for this recordType if needed
  if (!accumulator.cellCounts.base.has(recordType)) {
    accumulator.cellCounts.base.set(recordType, new Map());
  }
  
  // Increment base count
  const baseCounts = accumulator.cellCounts.base.get(recordType)!;
  baseCounts.set(cellId, (baseCounts.get(cellId) || 0) + 1);
  
  // Process tags if they exist
  const tags = feature.tags || [];
  for (const tag of tags) {
    // Track this tag globally
    accumulator.collectedTags.add(tag);
    accumulator.vocabulary.tags.add(tag);
    
    // Initialize tag structure if needed
    if (!accumulator.cellCounts.tags.has(tag)) {
      accumulator.cellCounts.tags.set(tag, new Map());
    }
    
    const tagCounts = accumulator.cellCounts.tags.get(tag)!;
    if (!tagCounts.has(recordType)) {
      tagCounts.set(recordType, new Map());
    }
    
    // Increment tag count
    const recordTypeTagCounts = tagCounts.get(recordType)!;
    recordTypeTagCounts.set(cellId, (recordTypeTagCounts.get(cellId) || 0) + 1);
  }
}

/**
 * Stream features and dynamically accumulate counts for multiple resolutions with vocabulary discovery
 */
export async function accumulateCountsWithDiscovery(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  resolutionConfigs: HeatmapResolutionConfig[],
  timeSlice: TimeSlice
): Promise<{ accumulators: Map<string, DiscoveryHeatmapAccumulator>; globalVocabulary: VocabularyTracker }> {
  
  // Create accumulators for each resolution
  const accumulators = new Map<string, DiscoveryHeatmapAccumulator>();
  let globalVocabulary = createVocabularyTracker();
  
  for (const resConfig of resolutionConfigs) {
    const resolutionKey = `${resConfig.cols}x${resConfig.rows}`;
    const heatmapDimensions: HeatmapDimensions = {
      colsAmount: resConfig.cols,
      rowsAmount: resConfig.rows,
      cellWidth: (bounds.maxLon - bounds.minLon) / resConfig.cols,
      cellHeight: (bounds.maxLat - bounds.minLat) / resConfig.rows,
      minLon: bounds.minLon,
      maxLon: bounds.maxLon,
      minLat: bounds.minLat,
      maxLat: bounds.maxLat
    };
    
    accumulators.set(resolutionKey, createDiscoveryHeatmapAccumulator(heatmapDimensions));
  }
  
  console.log(`🔍 Discovery accumulating counts for period: ${timeSlice.label} across ${resolutionConfigs.length} resolutions`);
  
  // Convert bounds for streaming (legacy format)
  const streamBounds = {
    minLon: bounds.minLon,
    maxLon: bounds.maxLon,
    minLat: bounds.minLat,
    maxLat: bounds.maxLat
  };
  
  // Stream data with discovery - don't filter by recordType
  for await (const result of streamFeaturesWithDiscovery(config, streamBounds, chunkConfig, {
    timeRange: timeSlice.timeRange
    // No recordtypes filter - discover all types
  })) {
    console.log(`📊 Processing ${result.features.length} discovered features from chunk ${result.chunk.id} for period ${timeSlice.label}`);
    
    // Merge chunk vocabulary into global vocabulary
    mergeVocabularies(globalVocabulary, result.vocabulary);
    
    // Process each feature into ALL accumulators
    for (const feature of result.features) {
      for (const [resolutionKey, accumulator] of accumulators) {
        processFeatureIntoDiscoveryCounts(feature, accumulator);
      }
    }
  }
  
  console.log(`✅ Completed discovery accumulation for ${timeSlice.label}`);
  
  return { accumulators, globalVocabulary };
}

/**
 * Generate heatmap timeline from discovery accumulator using dynamic vocabulary
 */
export function generateHeatmapTimelineFromDiscoveryAccumulator(
  accumulator: DiscoveryHeatmapAccumulator, 
  timeSlice: TimeSlice
): HeatmapTimeline {
  // Use discovered recordTypes instead of hardcoded ones
  const recordTypes = Array.from(accumulator.vocabulary.recordTypes);
  
  // Initialize result structure with timeline hierarchy using TimeSlice key
  const result: HeatmapTimeline = {
    [timeSlice.key]: {} as any
  };
  
  // Generate heatmaps for each discovered recordType
  for (const recordType of recordTypes) {
    // Initialize recordType structure
    result[timeSlice.key][recordType] = {
      base: generateHeatmap(new Map(), accumulator.heatmapDimensions), // Default empty
      tags: {}
    };
    
    // Generate base heatmap for this recordType
    const counts = accumulator.cellCounts.base.get(recordType) || new Map();
    result[timeSlice.key][recordType].base = generateHeatmap(counts, accumulator.heatmapDimensions);
    
    // Generate tag heatmaps for this recordType using discovered tags
    for (const tag of Array.from(accumulator.vocabulary.tags)) {
      const tagCounts = accumulator.cellCounts.tags.get(tag)?.get(recordType) || new Map();
      result[timeSlice.key][recordType].tags[tag] = generateHeatmap(tagCounts, accumulator.heatmapDimensions);
    }
  }
  
  return result;
}

/**
 * Generate heatmaps for multiple resolutions and TimeSlices with vocabulary discovery
 */
export async function generateHeatmapResolutionsWithDiscovery(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  resolutionConfigs: HeatmapResolutionConfig[],
  timeSlices: TimeSlice[]
): Promise<{ heatmapResolutions: HeatmapResolutions; globalVocabulary: VocabularyTracker }> {
  
  const result: HeatmapResolutions = {};
  let globalVocabulary = createVocabularyTracker();
  
  // Initialize all resolutions
  for (const resConfig of resolutionConfigs) {
    const resolutionKey = `${resConfig.cols}x${resConfig.rows}`;
    result[resolutionKey] = {};
  }
  
  console.log(`🔍 Generating discovery heatmaps for ${timeSlices.length} time slices and ${resolutionConfigs.length} resolutions`);
  
  for (const timeSlice of timeSlices) {
    console.log(`📅 Discovery processing time slice: ${timeSlice.label} (${timeSlice.timeRange.start} to ${timeSlice.timeRange.end})`);
    
    // Accumulate counts for ALL resolutions simultaneously with discovery
    const { accumulators, globalVocabulary: sliceVocabulary } = await accumulateCountsWithDiscovery(
      config,
      bounds,
      chunkConfig,
      resolutionConfigs,
      timeSlice
    );
    
    // Merge slice vocabulary into global vocabulary
    mergeVocabularies(globalVocabulary, sliceVocabulary);
    
    // Generate heatmaps for each resolution from its accumulator
    for (const [resolutionKey, accumulator] of accumulators) {
      // Initialize time slice if not exists
      if (!result[resolutionKey][timeSlice.key]) {
        result[resolutionKey][timeSlice.key] = {} as any;
      }
      
      // Generate heatmaps for each discovered recordType
      for (const recordType of Array.from(accumulator.vocabulary.recordTypes)) {
        // Initialize recordType structure
        result[resolutionKey][timeSlice.key][recordType] = {
          base: generateHeatmap(new Map(), accumulator.heatmapDimensions), // Default empty
          tags: {}
        };
        
        // Generate base heatmap
        const counts = accumulator.cellCounts.base.get(recordType) || new Map();
        result[resolutionKey][timeSlice.key][recordType].base = generateHeatmap(counts, accumulator.heatmapDimensions);
        
        // Generate tag heatmaps using discovered tags
        for (const tag of Array.from(accumulator.vocabulary.tags)) {
          const tagCounts = accumulator.cellCounts.tags.get(tag)?.get(recordType) || new Map();
          result[resolutionKey][timeSlice.key][recordType].tags[tag] = generateHeatmap(tagCounts, accumulator.heatmapDimensions);
        }
      }
    }
  }
  
  console.log(`✅ Completed discovery heatmap generation for all time slices and resolutions`);
  
  return { heatmapResolutions: result, globalVocabulary };
}

/**
 * Generate vocabulary-aware heatmap timeline for single resolution
 */
export async function generateDiscoveryHeatmapTimeline(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  heatmapDimensions: HeatmapDimensions,
  timeSlices: TimeSlice[]
): Promise<{ timeline: HeatmapTimeline; vocabulary: VocabularyTracker }> {
  
  // Use single resolution
  const resolutionConfigs: HeatmapResolutionConfig[] = [{
    cols: heatmapDimensions.colsAmount,
    rows: heatmapDimensions.rowsAmount
  }];
  
  const { heatmapResolutions, globalVocabulary } = await generateHeatmapResolutionsWithDiscovery(
    config,
    bounds,
    chunkConfig,
    resolutionConfigs,
    timeSlices
  );
  
  // Return the single resolution timeline
  const resolutionKey = `${heatmapDimensions.colsAmount}x${heatmapDimensions.rowsAmount}`;
  return { 
    timeline: heatmapResolutions[resolutionKey], 
    vocabulary: globalVocabulary 
  };
}
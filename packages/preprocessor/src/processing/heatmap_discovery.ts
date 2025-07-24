// src/processing/heatmap_discovery.ts - Dynamic heatmap generation with vocabulary discovery

import type { 
  MinimalFeature,
  HeatmapDimensions, 
  DatabaseConfig,
  ChunkingConfig,
  HeatmapTimeline,
  HeatmapResolutions,
  HeatmapResolutionConfig,
  HeatmapCellBounds,
  HeatmapBlueprint,
  TimeSlice,
  VocabularyTracker,
  DiscoveryHeatmapAccumulator
} from '@atm/shared/types';
import { 
  streamFeaturesWithDiscovery, 
  createVocabularyTracker, 
  mergeVocabularies
} from '../data-sources/streaming_discovery';
// Utility functions merged from heatmap.ts

/**
 * Get cell ID from coordinates
 */
export function getCellIdForCoordinates(
  coordinates: { lon: number; lat: number },
  heatmapDimensions: HeatmapDimensions
): string | null {
  const col = Math.floor((coordinates.lon - heatmapDimensions.minLon) / heatmapDimensions.cellWidth);
  const row = Math.floor((coordinates.lat - heatmapDimensions.minLat) / heatmapDimensions.cellHeight);

  if (row >= 0 && row < heatmapDimensions.rowsAmount && col >= 0 && col < heatmapDimensions.colsAmount) {
    return `${row}_${col}`;
  }
  return null;
}

/**
 * Generate heatmap from count data
 */
export function generateHeatmap(
  counts: Map<string, number>,
  heatmapDimensions: HeatmapDimensions
): { countArray: number[]; densityArray: number[] } {
  const totalCells = heatmapDimensions.rowsAmount * heatmapDimensions.colsAmount;
  const countarray = new Array<number>(totalCells).fill(0);
  
  // Fill count array
  for (const [cellId, count] of Array.from(counts.entries())) {
    const [row, col] = cellId.split('_').map(Number);
    const index = row * heatmapDimensions.colsAmount + col;
    countarray[index] = count;
  }
  
  // Find max count for normalization
  const maxCount = Math.max(...countarray, 0);
  
  // Generate density array with log transformation
  const densityarray = new Array<number>(totalCells).fill(0);
  
  if (maxCount > 0) {
    const maxTransformed = Math.log(maxCount + 1);
    for (let i = 0; i < totalCells; i++) {
      densityarray[i] = countarray[i] > 0 ? 
        Math.log(countarray[i] + 1) / maxTransformed : 0;
    }
  }
  
  return {
    countArray: countarray,
    densityArray: densityarray
  };
}

/**
 * Calculate cell bounds from row/col position
 */
export function calculateCellBounds(
  row: number, 
  col: number, 
  heatmapDimensions: HeatmapDimensions
): HeatmapCellBounds {
  const cellWidth = (heatmapDimensions.maxLon - heatmapDimensions.minLon) / heatmapDimensions.colsAmount;
  const cellHeight = (heatmapDimensions.maxLat - heatmapDimensions.minLat) / heatmapDimensions.rowsAmount;
  
  const minlon = heatmapDimensions.minLon + (col * cellWidth);
  const maxlon = minlon + cellWidth;
  const minlat = heatmapDimensions.minLat + (row * cellHeight);
  const maxlat = minlat + cellHeight;

  return { minLon: minlon, maxLon: maxlon, minLat: minlat, maxLat: maxlat };
}

/**
 * Generate heatmap blueprint from grid dimensions
 */
export function generateHeatmapBlueprint(heatmapDimensions: HeatmapDimensions): HeatmapBlueprint {
  const cells = [];
  
  for (let row = 0; row < heatmapDimensions.rowsAmount; row++) {
    for (let col = 0; col < heatmapDimensions.colsAmount; col++) {
      const cellId = `${row}_${col}`;
      const bounds = calculateCellBounds(row, col, heatmapDimensions);
      
      cells.push({
        cellId,
        row,
        col,
        bounds
      });
    }
  }
  
  return {
    rows: heatmapDimensions.rowsAmount,
    cols: heatmapDimensions.colsAmount,
    cells
  };
}

/**
 * Convenience function to create TimeSlice from simple time range
 */
export function createTimeSlice(
  startYear: number,
  endYear: number,
  options?: {
    keyFormat?: 'underscore' | 'hyphen';
    labelFormat?: 'hyphen' | 'to';
  }
): TimeSlice {
  const keyFormat = options?.keyFormat || 'underscore';
  const labelFormat = options?.labelFormat || 'hyphen';
  
  const key = keyFormat === 'underscore' ? `${startYear}_${endYear}` : `${startYear}-${endYear}`;
  const label = labelFormat === 'hyphen' ? `${startYear}-${endYear}` : `${startYear} to ${endYear}`;
  
  return {
    key,
    label,
    timeRange: {
      start: `${startYear}-01-01`,
      end: `${endYear}-12-31`
    },
    startYear,
    endYear,
    durationYears: endYear - startYear
  };
}

/**
 * Create multiple TimeSlices for common periods
 */
export function createTimeSlices(periods: Array<{ start: number; end: number }>): TimeSlice[] {
  return periods.map(period => createTimeSlice(period.start, period.end));
}

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
 * Process a single minimal feature into the discovery accumulator
 */
export function processFeatureIntoDiscoveryCounts(
  feature: MinimalFeature,
  accumulator: DiscoveryHeatmapAccumulator
): void {
  // Get cell position
  const cellId = getCellIdForCoordinates(feature.coordinates, accumulator.heatmapDimensions);
  
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
  for (const tag of feature.tags) {
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

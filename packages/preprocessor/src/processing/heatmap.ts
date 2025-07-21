// src/processing/heatmap.ts - Clean multi-resolution heatmap generation

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
  HeatmapBlueprint,
  HeatmapCellCounts,
  HeatmapAccumulator,
  TimeSlice
} from '@atm/shared/types';
import { streamFeaturesByChunks } from '../data-sources/streaming';

/**
 * Extract coordinates from feature geometry for cell positioning
 */
export function getFeatureCoordinates(feature: AnyProcessedFeature): Coordinates {
  switch (feature.geometry.type) {
    case 'Point':
      return feature.geometry.coordinates;
    
    case 'MultiLineString':
    case 'LineString':
    case 'Polygon':
      // Use the precalculated centroid
      return feature.geometry.centroid;
    
    default:
      throw new Error(`Unsupported geometry type: ${(feature.geometry as any).type}`);
  }
}

/**
 * Get cell ID from coordinates
 */
export function getCellIdForCoordinates(
  coordinates: Coordinates,
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
 * Create empty heatmap accumulator
 */
export function createHeatmapAccumulator(heatmapDimensions: HeatmapDimensions): HeatmapAccumulator {
  return {
    cellCounts: {
      base: new Map(),
      tags: new Map()
    },
    heatmapDimensions: heatmapDimensions,
    collectedTags: new Set()
  };
}

/**
 * Process a single feature into the accumulator
 */
export function processFeatureIntoCounts(
  feature: AnyProcessedFeature,
  accumulator: HeatmapAccumulator
): void {
  // Get cell position
  const coordinates = getFeatureCoordinates(feature);
  const cellId = getCellIdForCoordinates(coordinates, accumulator.heatmapDimensions);
  
  if (!cellId) return; // Feature outside grid bounds
  
  const recordType = feature.recordType;
  
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
 * Stream features for multiple resolutions and accumulate counts
 */
export async function accumulateCountsForMultipleResolutions(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  recordTypes: RecordType[],
  resolutionConfigs: HeatmapResolutionConfig[],
  timeSlice: TimeSlice
): Promise<Map<string, HeatmapAccumulator>> {
  
  // Create accumulators for each resolution
  const accumulators = new Map<string, HeatmapAccumulator>();
  
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
    
    accumulators.set(resolutionKey, createHeatmapAccumulator(heatmapDimensions));
  }
  
  console.log(`🔥 Accumulating counts for recordTypes: ${recordTypes.join(', ')} in period: ${timeSlice.label} across ${resolutionConfigs.length} resolutions`);
  
  // Convert bounds for streaming (legacy format)
  const streamBounds = {
    minLon: bounds.minLon,
    maxLon: bounds.maxLon,
    minLat: bounds.minLat,
    maxLat: bounds.maxLat
  };
  
  // Stream data once, process into ALL resolutions simultaneously
  for await (const result of streamFeaturesByChunks(config, streamBounds, chunkConfig, {
    recordTypes: recordTypes,
    timeRange: timeSlice.timeRange
  })) {
    console.log(`📊 Processing ${result.features.length} mixed features from chunk ${result.chunk.id} for period ${timeSlice.label}`);
    
    // Process each feature into ALL accumulators
    for (const feature of result.features) {
      for (const [resolutionKey, accumulator] of accumulators) {
        processFeatureIntoCounts(feature, accumulator);
      }
    }
  }
  
  console.log(`✅ Completed accumulation for recordTypes: ${recordTypes.join(', ')} in ${timeSlice.label}:`);
  for (const [resolutionKey, accumulator] of accumulators) {
    const totalCells = Array.from(accumulator.cellCounts.base.values()).reduce((sum, recordTypeCounts) => sum + recordTypeCounts.size, 0);
    console.log(`   - ${resolutionKey}: ${totalCells} cells with data across all recordTypes`);
  }
  const firstAccumulator = accumulators.values().next().value;
  console.log(`   - Unique tags found: ${firstAccumulator?.collectedTags.size || 0}`);
  
  return accumulators;
}

/**
 * Generate heatmap from count data
 */
export function generateHeatmap(
  counts: Map<string, number>,
  heatmapDimensions: HeatmapDimensions
): Heatmap {
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
 * Generate complete heatmap timeline from accumulator using TimeSlice
 */
export function generateHeatmapTimelineFromAccumulator(
  accumulator: HeatmapAccumulator, 
  timeSlice: TimeSlice
): HeatmapTimeline {
  const recordTypes: RecordType[] = ['image', 'text', 'event'];
  
  // Initialize result structure with timeline hierarchy using TimeSlice key
  const result: HeatmapTimeline = {
    [timeSlice.key]: {} as any
  };
  
  // Generate heatmaps for each recordType
  for (const recordType of recordTypes) {
    // Initialize recordType structure
    result[timeSlice.key][recordType] = {
      base: generateHeatmap(new Map(), accumulator.heatmapDimensions), // Default empty
      tags: {}
    };
    
    // Generate base heatmap for this recordType
    const counts = accumulator.cellCounts.base.get(recordType) || new Map();
    result[timeSlice.key][recordType].base = generateHeatmap(counts, accumulator.heatmapDimensions);
    
    // Generate tag heatmaps for this recordType
    for (const tag of Array.from(accumulator.collectedTags)) {
      const tagCounts = accumulator.cellCounts.tags.get(tag)?.get(recordType) || new Map();
      result[timeSlice.key][recordType].tags[tag] = generateHeatmap(tagCounts, accumulator.heatmapDimensions);
    }
  }
  
  return result;
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
 * Generate heatmaps for multiple resolutions and TimeSlices
 */
export async function generateHeatmapResolutions(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  recordTypes: RecordType[],
  resolutionConfigs: HeatmapResolutionConfig[],
  timeSlices: TimeSlice[]
): Promise<HeatmapResolutions> {
  
  const result: HeatmapResolutions = {};
  
  // Initialize all resolutions
  for (const resConfig of resolutionConfigs) {
    const resolutionKey = `${resConfig.cols}x${resConfig.rows}`;
    result[resolutionKey] = {};
  }
  
  console.log(`🔥 Generating heatmaps for ${timeSlices.length} time slices, ${recordTypes.length} recordTypes, and ${resolutionConfigs.length} resolutions`);
  
  for (const timeSlice of timeSlices) {
    console.log(`📅 Processing time slice: ${timeSlice.label} (${timeSlice.timeRange.start} to ${timeSlice.timeRange.end})`);
    
    // Accumulate counts for ALL resolutions simultaneously (stream data once for all recordTypes)
    const accumulators = await accumulateCountsForMultipleResolutions(
      config,
      bounds,
      chunkConfig,
      recordTypes,
      resolutionConfigs,
      timeSlice
    );
    
    // Generate heatmaps for each resolution from its accumulator
    for (const [resolutionKey, accumulator] of accumulators) {
      // Initialize time slice if not exists
      if (!result[resolutionKey][timeSlice.key]) {
        result[resolutionKey][timeSlice.key] = {} as any;
      }
      
      // Generate heatmaps for each recordType from the single accumulator
      for (const recordType of recordTypes) {
        // Initialize recordType structure
        result[resolutionKey][timeSlice.key][recordType] = {
          base: generateHeatmap(new Map(), accumulator.heatmapDimensions), // Default empty
          tags: {}
        };
        
        // Generate base heatmap
        const counts = accumulator.cellCounts.base.get(recordType) || new Map();
        result[resolutionKey][timeSlice.key][recordType].base = generateHeatmap(counts, accumulator.heatmapDimensions);
        
        // Generate tag heatmaps
        for (const tag of Array.from(accumulator.collectedTags)) {
          const tagCounts = accumulator.cellCounts.tags.get(tag)?.get(recordType) || new Map();
          result[resolutionKey][timeSlice.key][recordType].tags[tag] = generateHeatmap(tagCounts, accumulator.heatmapDimensions);
        }
      }
    }
  }
  
  console.log(`✅ Completed heatmap generation for all time slices, recordTypes, and resolutions`);
  console.log(`📊 Generated ${Object.keys(result).length} resolutions: ${Object.keys(result).join(', ')}`);
  
  return result;
}

/**
 * Generate heatmaps for a specific recordType using TimeSlice (single resolution)
 */
export async function generateHeatmapTimelineForRecordType(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  recordType: RecordType,
  heatmapDimensions: HeatmapDimensions,
  timeSlice: TimeSlice
): Promise<HeatmapTimeline> {
  
  console.log(`📊 Generating heatmap timeline for recordType: ${recordType} in period: ${timeSlice.label}`);
  
  // Use single resolution config
  const resolutionConfigs: HeatmapResolutionConfig[] = [{
    cols: heatmapDimensions.colsAmount,
    rows: heatmapDimensions.rowsAmount
  }];
  
  // Accumulate counts by streaming
  const accumulators = await accumulateCountsForMultipleResolutions(
    config,
    bounds,
    chunkConfig,
    [recordType],
    resolutionConfigs,
    timeSlice
  );
  
  // Get the single accumulator
  const accumulator = accumulators.values().next().value;
  
  // Generate timeline from accumulated counts
  if (!accumulator) {
    throw new Error(`No accumulator found for time slice: ${timeSlice.label}`);
  }
  return generateHeatmapTimelineFromAccumulator(accumulator, timeSlice);
}

/**
 * Generate heatmaps for multiple TimeSlices (single resolution)
 */
export async function generateHeatmapTimelineForMultipleTimeSlices(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  recordTypes: RecordType[],
  heatmapDimensions: HeatmapDimensions,
  timeSlices: TimeSlice[]
): Promise<HeatmapTimeline> {
  
  // Use single resolution
  const resolutionConfigs: HeatmapResolutionConfig[] = [{
    cols: heatmapDimensions.colsAmount,
    rows: heatmapDimensions.rowsAmount
  }];
  
  const resolutions = await generateHeatmapResolutions(
    config,
    bounds,
    chunkConfig,
    recordTypes,
    resolutionConfigs,
    timeSlices
  );
  
  // Return the single resolution timeline
  const resolutionKey = `${heatmapDimensions.colsAmount}x${heatmapDimensions.rowsAmount}`;
  return resolutions[resolutionKey];
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

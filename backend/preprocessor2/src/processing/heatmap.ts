// src/processing/heatmap.ts - Pure functions for heatmap generation (UPDATED: TimeSlice integration)

import type { 
  RecordType, 
  AnyProcessedFeature, 
  GridDimensions, 
  GridCellBounds,
  Coordinates 
} from '../types/geo';
import type { DatabaseConfig, ChunkingConfig } from '../data-sources';
import type { TimeSlice } from './';
import { streamFeaturesByChunks } from '../data-sources';

export interface Heatmap {
  densityArray: number[];
  countArray: number[];
}

// ✅ UPDATED: Period-first hierarchical structure using TimeSlice keys
export interface HeatmapStack {
  [periodKey: string]: {
    [recordType in RecordType]: {
      base: Heatmap;
      tags: Record<string, Heatmap>;
    }
  };
}

export interface HeatmapBlueprint {
  rows: number;
  cols: number;
  cells: Array<{
    cellId: string;
    row: number;
    col: number;
    bounds: GridCellBounds;
  }>;
}

export interface CellCounts {
  // Base counts per recordtype per cell
  base: Map<RecordType, Map<string, number>>;
  // Tag counts per tag per recordtype per cell  
  tags: Map<string, Map<RecordType, Map<string, number>>>;
}

export interface HeatmapAccumulator {
  cellCounts: CellCounts;
  gridDimensions: GridDimensions;
  collectedTags: Set<string>;
}

export interface GridConfig {
  colsAmount: number;
  rowsAmount: number;
  padding: number; // e.g., 0.05 = 5% padding
}

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
  gridDimensions: GridDimensions
): string | null {
  const col = Math.floor((coordinates.lon - gridDimensions.minLon) / gridDimensions.cellWidth);
  const row = Math.floor((coordinates.lat - gridDimensions.minLat) / gridDimensions.cellHeight);

  if (row >= 0 && row < gridDimensions.rowsAmount && col >= 0 && col < gridDimensions.colsAmount) {
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
  gridDimensions: GridDimensions
): GridCellBounds {
  const cellWidth = (gridDimensions.maxLon - gridDimensions.minLon) / gridDimensions.colsAmount;
  const cellHeight = (gridDimensions.maxLat - gridDimensions.minLat) / gridDimensions.rowsAmount;
  
  const minLon = gridDimensions.minLon + (col * cellWidth);
  const maxLon = minLon + cellWidth;
  const minLat = gridDimensions.minLat + (row * cellHeight);
  const maxLat = minLat + cellHeight;

  return { minLon, maxLon, minLat, maxLat };
}

/**
 * Create empty heatmap accumulator
 */
export function createHeatmapAccumulator(gridDimensions: GridDimensions): HeatmapAccumulator {
  return {
    cellCounts: {
      base: new Map(),
      tags: new Map()
    },
    gridDimensions,
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
  const cellId = getCellIdForCoordinates(coordinates, accumulator.gridDimensions);
  
  if (!cellId) return; // Feature outside grid bounds
  
  const recordtype = feature.recordtype;
  
  // Initialize base counts for this recordtype if needed
  if (!accumulator.cellCounts.base.has(recordtype)) {
    accumulator.cellCounts.base.set(recordtype, new Map());
  }
  
  // Increment base count
  const baseCounts = accumulator.cellCounts.base.get(recordtype)!;
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
    if (!tagCounts.has(recordtype)) {
      tagCounts.set(recordtype, new Map());
    }
    
    // Increment tag count
    const recordtypeTagCounts = tagCounts.get(recordtype)!;
    recordtypeTagCounts.set(cellId, (recordtypeTagCounts.get(cellId) || 0) + 1);
  }
}

/**
 * ✅ UPDATED: Stream features for a specific recordtype and TimeSlice
 */
export async function accumulateCountsForRecordtype(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtype: RecordType,
  gridDimensions: GridDimensions,
  timeSlice: TimeSlice
): Promise<HeatmapAccumulator> {
  
  const accumulator = createHeatmapAccumulator(gridDimensions);
  
  console.log(`🔥 Accumulating counts for recordtype: ${recordtype} in period: ${timeSlice.label}`);
  
  for await (const result of streamFeaturesByChunks(config, bounds, chunkConfig, {
    recordtype,
    timeRange: timeSlice.timeRange
  })) {
    console.log(`📊 Processing ${result.features.length} ${recordtype} features from chunk ${result.chunk.id} for period ${timeSlice.label}`);
    
    // Process each feature into counts
    for (const feature of result.features) {
      processFeatureIntoCounts(feature, accumulator);
    }
  }
  
  console.log(`✅ Completed accumulation for ${recordtype} in ${timeSlice.label}:`);
  console.log(`   - Cells with data: ${accumulator.cellCounts.base.get(recordtype)?.size || 0}`);
  console.log(`   - Unique tags found: ${accumulator.collectedTags.size}`);
  
  return accumulator;
}

/**
 * Generate heatmap from count data
 */
export function generateHeatmap(
  counts: Map<string, number>,
  gridDimensions: GridDimensions
): Heatmap {
  const totalCells = gridDimensions.rowsAmount * gridDimensions.colsAmount;
  const countArray = new Array<number>(totalCells).fill(0);
  
  // Fill count array
  for (const [cellId, count] of Array.from(counts.entries())) {
    const [row, col] = cellId.split('_').map(Number);
    const index = row * gridDimensions.colsAmount + col;
    countArray[index] = count;
  }
  
  // Find max count for normalization
  const maxCount = Math.max(...countArray, 0);
  
  // Generate density array with log transformation
  const densityArray = new Array<number>(totalCells).fill(0);
  
  if (maxCount > 0) {
    const maxTransformed = Math.log(maxCount + 1);
    for (let i = 0; i < totalCells; i++) {
      densityArray[i] = countArray[i] > 0 ? 
        Math.log(countArray[i] + 1) / maxTransformed : 0;
    }
  }
  
  return {
    countArray,
    densityArray
  };
}

/**
 * ✅ UPDATED: Generate complete heatmap stack from accumulator using TimeSlice
 */
export function generateHeatmapStack(
  accumulator: HeatmapAccumulator, 
  timeSlice: TimeSlice
): HeatmapStack {
  const recordtypes: RecordType[] = ['image', 'text', 'event'];
  
  // Initialize result structure with period-first hierarchy using TimeSlice key
  const result: HeatmapStack = {
    [timeSlice.key]: {} as any
  };
  
  // Generate heatmaps for each recordtype
  for (const recordtype of recordtypes) {
    // Initialize recordtype structure
    result[timeSlice.key][recordtype] = {
      base: generateHeatmap(new Map(), accumulator.gridDimensions), // Default empty
      tags: {}
    };
    
    // Generate base heatmap for this recordtype
    const counts = accumulator.cellCounts.base.get(recordtype) || new Map();
    result[timeSlice.key][recordtype].base = generateHeatmap(counts, accumulator.gridDimensions);
    
    // Generate tag heatmaps for this recordtype
    for (const tag of Array.from(accumulator.collectedTags)) {
      const tagCounts = accumulator.cellCounts.tags.get(tag)?.get(recordtype) || new Map();
      result[timeSlice.key][recordtype].tags[tag] = generateHeatmap(tagCounts, accumulator.gridDimensions);
    }
  }
  
  return result;
}

/**
 * Generate heatmap blueprint from grid dimensions
 */
export function generateHeatmapBlueprint(gridDimensions: GridDimensions): HeatmapBlueprint {
  const cells = [];
  
  for (let row = 0; row < gridDimensions.rowsAmount; row++) {
    for (let col = 0; col < gridDimensions.colsAmount; col++) {
      const cellId = `${row}_${col}`;
      const bounds = calculateCellBounds(row, col, gridDimensions);
      
      cells.push({
        cellId,
        row,
        col,
        bounds
      });
    }
  }
  
  return {
    rows: gridDimensions.rowsAmount,
    cols: gridDimensions.colsAmount,
    cells
  };
}

/**
 * ✅ UPDATED: Generate heatmaps for a specific recordtype using TimeSlice
 */
export async function generateHeatmapsForRecordtype(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtype: RecordType,
  gridDimensions: GridDimensions,
  timeSlice: TimeSlice
): Promise<HeatmapStack> {
  
  console.log(`📊 Generating heatmaps for recordtype: ${recordtype} in period: ${timeSlice.label}`);
  
  // Accumulate counts by streaming
  const accumulator = await accumulateCountsForRecordtype(
    config,
    bounds,
    chunkConfig,
    recordtype,
    gridDimensions,
    timeSlice
  );
  
  // Generate heatmaps from accumulated counts
  return generateHeatmapStack(accumulator, timeSlice);
}

/**
 * ✅ UPDATED: Generate heatmaps for multiple TimeSlices and recordtypes
 */
export async function generateHeatmapsForMultipleTimeSlices(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtypes: RecordType[],
  gridDimensions: GridDimensions,
  timeSlices: TimeSlice[]
): Promise<HeatmapStack> {
  
  const result: HeatmapStack = {};
  
  console.log(`🔥 Generating heatmaps for ${timeSlices.length} time slices and ${recordtypes.length} recordtypes`);
  
  for (const timeSlice of timeSlices) {
    console.log(`📅 Processing time slice: ${timeSlice.label} (${timeSlice.timeRange.start} to ${timeSlice.timeRange.end})`);
    
    // Initialize time slice structure
    result[timeSlice.key] = {} as any;
    
    for (const recordtype of recordtypes) {
      console.log(`📊 Processing recordtype: ${recordtype} for time slice ${timeSlice.label}`);
      
      // Accumulate counts for this recordtype and time slice
      const accumulator = await accumulateCountsForRecordtype(
        config,
        bounds,
        chunkConfig,
        recordtype,
        gridDimensions,
        timeSlice
      );
      
      // Initialize recordtype structure
      result[timeSlice.key][recordtype] = {
        base: generateHeatmap(new Map(), gridDimensions), // Default empty
        tags: {}
      };
      
      // Generate base heatmap
      const counts = accumulator.cellCounts.base.get(recordtype) || new Map();
      result[timeSlice.key][recordtype].base = generateHeatmap(counts, gridDimensions);
      
      // Generate tag heatmaps
      for (const tag of Array.from(accumulator.collectedTags)) {
        const tagCounts = accumulator.cellCounts.tags.get(tag)?.get(recordtype) || new Map();
        result[timeSlice.key][recordtype].tags[tag] = generateHeatmap(tagCounts, gridDimensions);
      }
    }
  }
  
  console.log(`✅ Completed heatmap generation for all time slices and recordtypes`);
  return result;
}

/**
 * ✅ NEW: Convenience function to create TimeSlice from simple time range
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
 * ✅ NEW: Create multiple TimeSlices for common periods
 */
export function createTimeSlices(periods: Array<{ start: number; end: number }>): TimeSlice[] {
  return periods.map(period => createTimeSlice(period.start, period.end));
}

/**
 * ✅ NEW: Analyze heatmap stack across time slices
 */
export function analyzeHeatmapStack(
  heatmapStack: HeatmapStack,
  timeSlices: TimeSlice[]
): {
  totalTimeSlices: number;
  totalCells: number;
  recordtypeStats: Record<RecordType, {
    totalFeatures: number;
    peakTimeSlice: { key: string; label: string; count: number };
    averagePerTimeSlice: number;
  }>;
  overallStats: {
    totalFeatures: number;
    peakTimeSlice: { key: string; label: string; count: number };
    mostActiveRecordtype: RecordType;
  };
} {
  const recordtypeStats: Record<RecordType, any> = {
    text: { totalFeatures: 0, peakTimeSlice: { key: '', label: '', count: 0 }, averagePerTimeSlice: 0 },
    image: { totalFeatures: 0, peakTimeSlice: { key: '', label: '', count: 0 }, averagePerTimeSlice: 0 },
    event: { totalFeatures: 0, peakTimeSlice: { key: '', label: '', count: 0 }, averagePerTimeSlice: 0 }
  };
  
  let overallTotal = 0;
  let overallPeak = { key: '', label: '', count: 0 };
  let totalCells = 0;
  
  // Analyze each time slice
  for (const timeSlice of timeSlices) {
    const timeSliceData = heatmapStack[timeSlice.key];
    if (!timeSliceData) continue;
    
    let timeSliceTotal = 0;
    
    // Analyze each recordtype
    for (const recordtype of ['text', 'image', 'event'] as RecordType[]) {
      const recordtypeData = timeSliceData[recordtype];
      if (!recordtypeData) continue;
      
      const counts = Array.from(recordtypeData.base.countArray);
      const recordtypeCount = counts.reduce((sum, count) => sum + count, 0);
      
      recordtypeStats[recordtype].totalFeatures += recordtypeCount;
      timeSliceTotal += recordtypeCount;
      
      // Track peak time slice for this recordtype
      if (recordtypeCount > recordtypeStats[recordtype].peakTimeSlice.count) {
        recordtypeStats[recordtype].peakTimeSlice = {
          key: timeSlice.key,
          label: timeSlice.label,
          count: recordtypeCount
        };
      }
      
      // Set total cells from first non-empty recordtype
      if (totalCells === 0) {
        totalCells = counts.length;
      }
    }
    
    overallTotal += timeSliceTotal;
    
    // Track overall peak time slice
    if (timeSliceTotal > overallPeak.count) {
      overallPeak = {
        key: timeSlice.key,
        label: timeSlice.label,
        count: timeSliceTotal
      };
    }
  }
  
  // Calculate averages and find most active recordtype
  let mostActiveRecordtype: RecordType = 'text';
  let mostActiveCount = 0;
  
  for (const recordtype of ['text', 'image', 'event'] as RecordType[]) {
    recordtypeStats[recordtype].averagePerTimeSlice = Math.round(
      recordtypeStats[recordtype].totalFeatures / timeSlices.length
    );
    
    if (recordtypeStats[recordtype].totalFeatures > mostActiveCount) {
      mostActiveCount = recordtypeStats[recordtype].totalFeatures;
      mostActiveRecordtype = recordtype;
    }
  }
  
  return {
    totalTimeSlices: timeSlices.length,
    totalCells,
    recordtypeStats,
    overallStats: {
      totalFeatures: overallTotal,
      peakTimeSlice: overallPeak,
      mostActiveRecordtype
    }
  };
}

// ✅ DEPRECATED: Keep for backward compatibility but mark as deprecated
/**
 * @deprecated Use generateHeatmapsForMultipleTimeSlices instead
 */
export async function generateHeatmapsForMultiplePeriods(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtypes: RecordType[],
  gridDimensions: GridDimensions,
  periods: Array<{ key: string; timeRange: { start: string; end: string } }>
): Promise<HeatmapStack> {
  console.warn('⚠️ generateHeatmapsForMultiplePeriods is deprecated. Use generateHeatmapsForMultipleTimeSlices instead.');
  
  // Convert old format to TimeSlice format
  const timeSlices: TimeSlice[] = periods.map(period => {
    const startYear = parseInt(period.timeRange.start.split('-')[0]);
    const endYear = parseInt(period.timeRange.end.split('-')[0]);
    
    return {
      key: period.key,
      label: period.key.replace('_', '-'),
      timeRange: period.timeRange,
      startYear,
      endYear,
      durationYears: endYear - startYear
    };
  });
  
  return generateHeatmapsForMultipleTimeSlices(
    config,
    bounds,
    chunkConfig,
    recordtypes,
    gridDimensions,
    timeSlices
  );
}

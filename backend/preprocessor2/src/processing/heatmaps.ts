// src/processing/heatmaps.ts - Pure functions for heatmap generation

import type { 
  RecordType, 
  AnyProcessedFeature, 
  GridDimensions, 
  GridCellBounds,
  Coordinates 
} from '../types/geo';
import type { DatabaseConfig, ChunkingConfig } from '../data-sources';
import { streamFeaturesByChunks } from '../data-sources';

export interface Heatmap {
  densityArray: number[];
  countArray: number[];
}

export interface HeatmapStack {
  // Base heatmap per recordtype
  base: {
    [K in RecordType]: Heatmap;
  };
  
  // Tag-specific heatmaps (unified tags)
  tags: {
    [tagName: string]: {
      [K in RecordType]: Heatmap;
    };
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
 * Stream features for a specific recordtype and accumulate counts
 */
export async function accumulateCountsForRecordtype(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtype: RecordType,
  gridDimensions: GridDimensions,
  timeRange?: { start: string; end: string }
): Promise<HeatmapAccumulator> {
  
  const accumulator = createHeatmapAccumulator(gridDimensions);
  
  console.log(`🔥 Accumulating counts for recordtype: ${recordtype}`);
  
  for await (const result of streamFeaturesByChunks(config, bounds, chunkConfig, {
    recordtype,
    timeRange
  })) {
    console.log(`📊 Processing ${result.features.length} ${recordtype} features from chunk ${result.chunk.id}`);
    
    // Process each feature into counts
    for (const feature of result.features) {
      processFeatureIntoCounts(feature, accumulator);
    }
  }
  
  console.log(`✅ Completed accumulation for ${recordtype}:`);
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
    densityArray,
  };
}

/**
 * Generate complete heatmap stack from accumulator
 */
export function generateHeatmapStack(accumulator: HeatmapAccumulator): HeatmapStack {
  const recordtypes: RecordType[] = ['text'];
  
  // Initialize result structure
  const result: HeatmapStack = {
    base: {} as any,
    tags: {}
  };
  
  // Generate base heatmaps for each recordtype
  for (const recordtype of recordtypes) {
    const counts = accumulator.cellCounts.base.get(recordtype) || new Map();
    result.base[recordtype] = generateHeatmap(counts, accumulator.gridDimensions);
  }
  
  // Generate tag heatmaps
  for (const tag of Array.from(accumulator.collectedTags)) {
    result.tags[tag] = {} as any;
    
    for (const recordtype of recordtypes) {
      const tagCounts = accumulator.cellCounts.tags.get(tag)?.get(recordtype) || new Map();
      result.tags[tag][recordtype] = generateHeatmap(tagCounts, accumulator.gridDimensions);
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
 * Generate heatmaps for a specific recordtype (main function)
 */
export async function generateHeatmapsForRecordtype(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtype: RecordType,
  gridDimensions: GridDimensions,
  timeRange?: { start: string; end: string }
): Promise<HeatmapStack> {
  
  // Accumulate counts by streaming
  const accumulator = await accumulateCountsForRecordtype(
    config,
    bounds,
    chunkConfig,
    recordtype,
    gridDimensions,
    timeRange
  );
  
  // Generate heatmaps from accumulated counts
  return generateHeatmapStack(accumulator);
}

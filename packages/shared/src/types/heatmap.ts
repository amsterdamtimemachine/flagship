import type { RecordType } from './feature';

export interface Heatmap {
  densityArray: number[];
  countArray: number[];
}

export interface HeatmapTimeline {
  [timeSliceKey: string]: {
    [recordType in RecordType]: {
      base: Heatmap;
      tags: Record<string, Heatmap>;
    }
  };
}

export interface HeatmapResolutions {
  [resolution: string]: HeatmapTimeline;
}

export interface HeatmapResolutionConfig {
  cols: number;
  rows: number;
}

export interface HeatmapDimensions {
    colsAmount: number;
    rowsAmount: number;
    cellWidth: number;
    cellHeight: number;
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
}

// Generic Bounds from spatial.ts should be used instead of this
export interface HeatmapCellBounds { 
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
}


export interface HeatmapBlueprintCell {
  cellId: string;
  row: number;
  col: number;
  bounds: HeatmapCellBounds;
}

export interface HeatmapBlueprint {
  rows: number;
  cols: number;
  cells: HeatmapBlueprintCell[];
}

export interface HeatmapCellCounts {
  // Base counts per recordtype per cell
  base: Map<RecordType, Map<string, number>>;
  // Tag counts per tag per recordtype per cell  
  tags: Map<string, Map<RecordType, Map<string, number>>>;
  // Tag combination counts per combination per recordtype per cell
  tagCombinations: Map<string, Map<RecordType, Map<string, number>>>;
}

export interface HeatmapAccumulator {
  cellCounts: HeatmapCellCounts;
  heatmapDimensions: HeatmapDimensions;
  collectedTags: Set<string>;
  maxTagCombinations: number;
  tagCombinationStats: Map<string, number>;
}

export interface HeatmapConfig {
  colsAmount: number;
  rowsAmount: number;
  padding: number;
}



import type { RecordType } from './feature';

export interface HeatmapCellBounds {
    minLon: number;
    maxLon: number;
    minLat: number;
    maxLat: number;
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

export interface HeatmapConfig {
  colsAmount: number;
  rowsAmount: number;
  padding: number; // e.g., 0.05 = 5% padding
}

export interface Heatmap {
  densityArray: number[];
  countArray: number[];
}

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
    bounds: HeatmapCellBounds;
  }>;
}

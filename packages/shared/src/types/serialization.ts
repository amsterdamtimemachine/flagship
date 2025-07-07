import { HeatmapBlueprint, HeatmapTimeline, HeatmapDimensions, HeatmapResolutions, HeatmapResolutionConfig } from "./heatmap";
import { Histogram } from "./histogram";
import { TimeSlice } from "./temporal";
import { RecordType } from "./feature";

export interface VisualizationMetadata {
  version: string;
  timestamp: string;
  heatmapDimensions: HeatmapDimensions; // Primary resolution (backward compatibility)
  heatmapBlueprint: HeatmapBlueprint;
  timeSlices: TimeSlice[];
  timeRange: {
    start: string;
    end: string;
  };
  recordTypes: RecordType[];
  tags: string[];
  resolutions: HeatmapResolutionConfig[];
  resolutionDimensions: Record<string, HeatmapDimensions>; // All resolutions with their dimensions
  sections: {
    heatmaps: {
      offset: number;
      length: number;
    };
    histograms: {
      offset: number;
      length: number;
    };
  };
  stats?: {
    totalFeatures: number;
    featuresPerRecordType: Record<RecordType, number>;
    timeSliceCount: number;
    gridCellCount: number;
    resolutionCount: number;
  };
}

export interface Histograms {
  [recordType: string]: {
    base: Histogram;                    // Timeline for this recordType (all periods)
    tags: Record<string, Histogram>;   // Timeline for this recordType+tag (all periods)
  }
}

export interface VisualizationData {
  heatmaps: HeatmapResolutions;
  histograms: Histograms;
}

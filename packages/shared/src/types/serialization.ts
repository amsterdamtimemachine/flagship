import { HeatmapBlueprint, HeatmapTimeline, HeatmapDimensions } from "./heatmap";
import { TimeSlice } from "./temporal";
import { RecordType } from "./feature";

export interface VisualizationMetadata {
  version: string;
  timestamp: string;
  heatmapDimensions: HeatmapDimensions;
  heatmapBlueprint: HeatmapBlueprint;
  timeSlices: TimeSlice[];
  timeRange: {
    start: string;
    end: string;
  };
  recordTypes: RecordType[];
  tags: string[];
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
    featuresPerRecordtype: Record<RecordType, number>;
    timeSliceCount: number;
    gridCellCount: number;
  };
}

export interface VisualizationData {
  heatmaps: HeatmapTimeline;
  histograms: HistogramStack;
}

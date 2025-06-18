import type { RecordType } from "./feature";


export interface HistogramBin {
  period: string;
  count: number;
  contentCounts: {
    [K in RecordType]: number;
  };
  tagCounts: {
    [K in RecordType]: {
      [tagName: string]: number;
    };
  };
}

export interface Histogram {
  bins: HistogramBin[];
  maxCount: number;
  contentMaxCounts: {
    [K in RecordType]: number;
  };
}

// ✅ Period-first structure (matches heatmaps)
export interface HistogramStack {
  [period: string]: {
    [recordType in RecordType]: {
      base: HistogramBin;
      tags: Record<string, HistogramBin>;
    }
  };
}

export interface HistogramAccumulator {
  bins: Map<string, HistogramBin>;           // period -> bin data
  collectedTags: Set<string>;                // all tags found across all periods
  contentMaxCounts: Record<RecordType, number>; // max count per recordtype
  maxCount: number;                          // overall max count
}

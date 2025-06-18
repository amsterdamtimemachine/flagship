// src/processing/histograms.ts - Pure functions for histogram generation (streaming, period-first)

import type { 
  DatabaseConfig,
  ChunkingConfig,
  TimeSlice,
  RecordType, 
  AnyProcessedFeature, 
  GridCellBounds,
  HistogramBin,
  Histogram,
  HistogramStack,
  HistogramAccumulator,
} from '../types/geo';
import { streamFeaturesByChunks } from '../data-sources/streaming';

/**
 * Create empty histogram accumulator
 */
export function createHistogramAccumulator(): HistogramAccumulator {
  return {
    bins: new Map(),
    collectedTags: new Set(),
    contentMaxCounts: {
      text: 0,
      image: 0,
      event: 0
    },
    maxCount: 0
  };
}

/**
 * Create empty histogram bin for a period
 */
export function createEmptyHistogramBin(period: string): HistogramBin {
  return {
    period,
    count: 0,
    contentCounts: {
      text: 0,
      image: 0,
      event: 0
    },
    tagCounts: {
      text: {},
      image: {},
      event: {}
    }
  };
}

/**
 * Process a single feature into histogram bin (temporal aggregation)
 */
export function processFeatureIntoHistogramBin(
  feature: AnyProcessedFeature,
  accumulator: HistogramAccumulator,
  periodKey: string
): void {
  // Get or create bin for this period
  if (!accumulator.bins.has(periodKey)) {
    accumulator.bins.set(periodKey, createEmptyHistogramBin(periodKey));
  }
  
  const bin = accumulator.bins.get(periodKey)!;
  const recordtype = feature.recordtype;
  
  // Increment total count for this period
  bin.count++;
  accumulator.maxCount = Math.max(accumulator.maxCount, bin.count);
  
  // Increment content count for this recordtype
  bin.contentCounts[recordtype]++;
  accumulator.contentMaxCounts[recordtype] = Math.max(
    accumulator.contentMaxCounts[recordtype], 
    bin.contentCounts[recordtype]
  );
  
  // Process tags (same logic as heatmaps)
  const tags = feature.tags || [];
  for (const tag of tags) {
    // Track this tag globally
    accumulator.collectedTags.add(tag);
    
    // Initialize tag structure if needed
    if (!bin.tagCounts[recordtype][tag]) {
      bin.tagCounts[recordtype][tag] = 0;
    }
    
    // Increment tag count
    bin.tagCounts[recordtype][tag]++;
  }
}

/**
 * Stream features for a specific period and accumulate into histogram
 */
export async function accumulateHistogramForPeriod(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtype: RecordType,
  periodSlice: TimeSlice,
  accumulator: HistogramAccumulator
): Promise<void> {
  
  console.log(`📊 Accumulating histogram for period: ${periodSlice.label} (${recordtype})`);
  
  let featureCount = 0;
  
  for await (const result of streamFeaturesByChunks(config, bounds, chunkConfig, {
    recordtype,
    timeRange: periodSlice.timeRange
  })) {
    console.log(`📈 Processing ${result.features.length} ${recordtype} features from chunk ${result.chunk.id} for period ${periodSlice.label}`);
    
    // Process each feature into histogram bin (not spatial cells)
    for (const feature of result.features) {
      processFeatureIntoHistogramBin(feature, accumulator, periodSlice.key);
      featureCount++;
    }
  }
  
  console.log(`✅ Period ${periodSlice.label}: ${featureCount} ${recordtype} features accumulated`);
}

/**
 * Generate histogram from accumulator data (convert to final format)
 */
export function generateHistogram(accumulator: HistogramAccumulator): Histogram {
  // Convert bins map to sorted array
  const bins = Array.from(accumulator.bins.values())
    .sort((a, b) => a.period.localeCompare(b.period));
  
  return {
    bins,
    maxCount: accumulator.maxCount,
    contentMaxCounts: accumulator.contentMaxCounts
  };
}

/**
 * ✅ Generate period-first histogram stack from accumulator (matches heatmap structure)
 */
export function generateHistogramStack(
  accumulator: HistogramAccumulator,
  periods: TimeSlice[]
): HistogramStack {
  const recordtypes: RecordType[] = ['image', 'text', 'event'];
  const result: HistogramStack = {};
  
  // Initialize all periods
  for (const period of periods) {
    result[period.key] = {} as any;
    
    // Initialize all recordtypes for this period
    for (const recordtype of recordtypes) {
      result[period.key][recordtype] = {
        base: createEmptyHistogramBin(period.key),
        tags: {}
      };
    }
  }
  
  // Fill in the data from accumulator
  for (const [periodKey, bin] of accumulator.bins.entries()) {
    if (result[periodKey]) {
      // Process each recordtype
      for (const recordtype of recordtypes) {
        // Base histogram bin for this recordtype in this period
        result[periodKey][recordtype].base = {
          period: periodKey,
          count: bin.contentCounts[recordtype],
          contentCounts: {
            [recordtype]: bin.contentCounts[recordtype],
            // Other recordtypes are 0 for this specific bin
            text: recordtype === 'text' ? bin.contentCounts[recordtype] : 0,
            image: recordtype === 'image' ? bin.contentCounts[recordtype] : 0,
            event: recordtype === 'event' ? bin.contentCounts[recordtype] : 0
          } as Record<RecordType, number>,
          tagCounts: {
            [recordtype]: bin.tagCounts[recordtype],
            // Other recordtypes are empty for this specific bin
            text: recordtype === 'text' ? bin.tagCounts[recordtype] : {},
            image: recordtype === 'image' ? bin.tagCounts[recordtype] : {},
            event: recordtype === 'event' ? bin.tagCounts[recordtype] : {}
          } as Record<RecordType, Record<string, number>>
        };
        
        // Tag-specific histogram bins
        for (const tag of Array.from(accumulator.collectedTags)) {
          const tagCount = bin.tagCounts[recordtype][tag] || 0;
          
          result[periodKey][recordtype].tags[tag] = {
            period: periodKey,
            count: tagCount,
            contentCounts: {
              [recordtype]: tagCount,
              text: recordtype === 'text' ? tagCount : 0,
              image: recordtype === 'image' ? tagCount : 0,
              event: recordtype === 'event' ? tagCount : 0
            } as Record<RecordType, number>,
            tagCounts: {
              [recordtype]: { [tag]: tagCount },
              text: recordtype === 'text' ? { [tag]: tagCount } : {},
              image: recordtype === 'image' ? { [tag]: tagCount } : {},
              event: recordtype === 'event' ? { [tag]: tagCount } : {}
            } as Record<RecordType, Record<string, number>>
          };
        }
      }
    }
  }
  
  return result;
}

/**
 * ✅ Generate histograms for a specific recordtype across multiple periods (matches heatmap API)
 */
export async function generateHistogramForRecordtype(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtype: RecordType,
  periods: TimeSlice[]
): Promise<HistogramStack> {
  
  const accumulator = createHistogramAccumulator();
  
  console.log(`📊 Generating histogram for recordtype: ${recordtype} across ${periods.length} periods`);
  
  // Stream features for each period
  for (const period of periods) {
    await accumulateHistogramForPeriod(
      config,
      bounds,
      chunkConfig,
      recordtype,
      period,
      accumulator
    );
  }
  
  console.log(`✅ Completed histogram accumulation for ${recordtype}:`);
  console.log(`   - Periods processed: ${periods.length}`);
  console.log(`   - Total periods with data: ${accumulator.bins.size}`);
  console.log(`   - Unique tags found: ${accumulator.collectedTags.size}`);
  console.log(`   - Max count: ${accumulator.maxCount}`);
  
  // Generate period-first histogram stack
  return generateHistogramStack(accumulator, periods);
}

/**
 * ✅ Generate histograms for multiple periods and recordtypes (matches heatmap API)
 */
export async function generateHistogramsForMultiplePeriods(
  config: DatabaseConfig,
  bounds: GridCellBounds,
  chunkConfig: ChunkingConfig,
  recordtypes: RecordType[],
  periods: TimeSlice[]
): Promise<HistogramStack> {
  
  const result: HistogramStack = {};
  
  console.log(`📊 Generating histograms for ${recordtypes.length} recordtypes across ${periods.length} periods`);
  
  // Initialize all periods
  for (const period of periods) {
    result[period.key] = {} as any;
  }
  
  // Process each recordtype
  for (const recordtype of recordtypes) {
    console.log(`📈 Processing recordtype: ${recordtype}`);
    
    const recordtypeHistograms = await generateHistogramForRecordtype(
      config,
      bounds,
      chunkConfig,
      recordtype,
      periods
    );
    
    // Merge into main result
    for (const [periodKey, periodData] of Object.entries(recordtypeHistograms)) {
      if (!result[periodKey]) {
        result[periodKey] = {} as any;
      }
      
      result[periodKey][recordtype] = periodData[recordtype];
    }
  }
  
  console.log(`✅ Completed histogram generation for all recordtypes and periods`);
  return result;
}

/**
 * ✅ Generate unified histogram showing totals across all recordtypes (convenience function)
 */
export function generateUnifiedHistogram(histogramStack: HistogramStack): Histogram {
  const periodKeys = Object.keys(histogramStack).sort();
  const bins: HistogramBin[] = [];
  let maxCount = 0;
  const contentMaxCounts: Record<RecordType, number> = {
    text: 0,
    image: 0,
    event: 0
  };
  
  for (const periodKey of periodKeys) {
    const periodData = histogramStack[periodKey];
    
    // Sum up all recordtypes for this period
    const bin: HistogramBin = {
      period: periodKey,
      count: 0,
      contentCounts: {
        text: 0,
        image: 0,
        event: 0
      },
      tagCounts: {
        text: {},
        image: {},
        event: {}
      }
    };
    
    // Aggregate across all recordtypes
    for (const recordtype of ['text', 'image', 'event'] as RecordType[]) {
      if (periodData[recordtype]) {
        const recordtypeData = periodData[recordtype].base;
        
        bin.count += recordtypeData.count;
        bin.contentCounts[recordtype] = recordtypeData.contentCounts[recordtype];
        bin.tagCounts[recordtype] = recordtypeData.tagCounts[recordtype];
        
        // Update max counts
        contentMaxCounts[recordtype] = Math.max(
          contentMaxCounts[recordtype],
          recordtypeData.contentCounts[recordtype]
        );
      }
    }
    
    maxCount = Math.max(maxCount, bin.count);
    bins.push(bin);
  }
  
  return {
    bins,
    maxCount,
    contentMaxCounts
  };
}

/**
 * ✅ Convenience function to analyze histogram data
 */
export function analyzeHistogram(histogram: Histogram): {
  totalFeatures: number;
  totalPeriods: number;
  peakPeriod: { period: string; count: number };
  averagePerPeriod: number;
  recordtypeDistribution: Record<RecordType, number>;
  timeSpan: { start: string; end: string };
} {
  const totalFeatures = histogram.bins.reduce((sum, bin) => sum + bin.count, 0);
  const totalPeriods = histogram.bins.length;
  
  const peakBin = histogram.bins.reduce((max, bin) => 
    bin.count > max.count ? bin : max, 
    histogram.bins[0] || { period: '', count: 0 }
  );
  
  const recordtypeDistribution = histogram.bins.reduce((dist, bin) => {
    dist.text += bin.contentCounts.text;
    dist.image += bin.contentCounts.image;
    dist.event += bin.contentCounts.event;
    return dist;
  }, { text: 0, image: 0, event: 0 });
  
  const sortedPeriods = histogram.bins.map(b => b.period).sort();
  
  return {
    totalFeatures,
    totalPeriods,
    peakPeriod: { period: peakBin.period, count: peakBin.count },
    averagePerPeriod: Math.round(totalFeatures / totalPeriods),
    recordtypeDistribution,
    timeSpan: {
      start: sortedPeriods[0] || '',
      end: sortedPeriods[sortedPeriods.length - 1] || ''
    }
  };
}

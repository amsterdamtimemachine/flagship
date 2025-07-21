// src/processing/histograms.ts - Updated histogram generation with flattened structure

import type { 
  DatabaseConfig,
  ChunkingConfig,
  TimeSlice,
  RecordType, 
  AnyProcessedFeature, 
  HeatmapCellBounds,
  HistogramBin,
  Histogram,
  HistogramAccumulator,
  HistogramRequest,
  HistogramApiResponse
} from '@atm/shared/types';
import { streamFeaturesByChunks } from '../data-sources/streaming';

/**
 * Create histogram accumulator for specific filter criteria
 */
export function createHistogramAccumulator(request: HistogramRequest): HistogramAccumulator {
  return {
    bins: new Map(),
    request: request,
    maxCount: 0
  };
}

/**
 * Create empty histogram bin for a time period
 */
export function createEmptyHistogramBin(timeSlice: TimeSlice): HistogramBin {
  return {
    timeSlice,
    count: 0
  };
}

/**
 * Check if feature matches the filter criteria
 */
export function featureMatchesFilters(
  feature: AnyProcessedFeature,
  request: HistogramRequest
): boolean {
  // Check record type filter
  if (request.recordTypes && !request.recordTypes.includes(feature.recordType)) {
    return false;
  }
  
  // Check tags filter (AND logic - feature must have ALL specified tags)
  if (request.tags && request.tags.length > 0) {
    const featureTags = feature.tags || [];
    const hasAllTags = request.tags.every(requiredTag => 
      featureTags.includes(requiredTag)
    );
    if (!hasAllTags) {
      return false;
    }
  }
  
  // Could add geographic bounds check here if needed
  // if (request.bounds) { ... }
  
  return true;
}

/**
 * Process a single feature into histogram bin if it matches filters
 */
export function processFeatureIntoHistogramBin(
  feature: AnyProcessedFeature,
  accumulator: HistogramAccumulator,
  timeSlice: TimeSlice
): void {
  // Only process if feature matches our filter criteria
  if (!featureMatchesFilters(feature, accumulator.request)) {
    return;
  }
  
  const periodKey = timeSlice.key;
  
  // Get or create bin for this period
  if (!accumulator.bins.has(periodKey)) {
    accumulator.bins.set(periodKey, createEmptyHistogramBin(timeSlice));
  }
  
  const bin = accumulator.bins.get(periodKey)!;
  
  // Increment count for this period (only for matching features)
  bin.count++;
  accumulator.maxCount = Math.max(accumulator.maxCount, bin.count);
}

/**
 * Stream features for a specific period and accumulate matching ones
 */
export async function accumulateHistogramForPeriod(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  timeSlice: TimeSlice,
  accumulator: HistogramAccumulator
): Promise<void> {
  
  console.log(`📊 Accumulating histogram for period: ${timeSlice.label}`);
  console.log(`   Filters: recordTypes=[${(accumulator.request.recordTypes || []).join(', ') || 'all'}], tags=[${(accumulator.request.tags || []).join(', ')}]`);
  
  let totalFeatureCount = 0;
  let matchingFeatureCount = 0;
  
  // Determine recordTypes to stream - use all available types if no specific filter
  const recordTypesToStream = accumulator.request.recordTypes 
    ? accumulator.request.recordTypes
    : ['text', 'image', 'event'] as RecordType[];
  
  // Stream all recordTypes in single API call
  for await (const result of streamFeaturesByChunks(config, bounds, chunkConfig, {
    recordTypes: recordTypesToStream,
    timeRange: timeSlice.timeRange
  })) {
    console.log(`📈 Processing ${result.features.length} mixed features from chunk ${result.chunk.id}`);
    
    // Process each feature, but only count if it matches filters
    for (const feature of result.features) {
      totalFeatureCount++;
      
      if (featureMatchesFilters(feature, accumulator.request)) {
        processFeatureIntoHistogramBin(feature, accumulator, timeSlice);
        matchingFeatureCount++;
      }
    }
  }
  
  console.log(`✅ Period ${timeSlice.label}: ${matchingFeatureCount}/${totalFeatureCount} features matched filters`);
}

/**
 * Generate final histogram from accumulator data
 */
export function generateHistogram(accumulator: HistogramAccumulator): Histogram {
  // Use ALL time periods from request, not just those with data
  // This ensures consistent timeline alignment across all histograms
  const bins = accumulator.request.timeSlices
    .sort((a, b) => a.startYear - b.startYear)
    .map(timeSlice => 
      accumulator.bins.get(timeSlice.key) || createEmptyHistogramBin(timeSlice)
    );
  
  // Calculate overall time range using the ordered bins
  const timeRange = bins.length > 0 ? {
    start: bins[0].timeSlice.timeRange.start,
    end: bins[bins.length - 1].timeSlice.timeRange.end
  } : { start: '', end: '' };
  
  // Calculate total features
  const totalFeatures = bins.reduce((sum, bin) => sum + bin.count, 0);
  
  return {
    bins,
    recordTypes: accumulator.request.recordTypes,
    tags: accumulator.request.tags,
    bounds: accumulator.request.bounds,
    maxCount: accumulator.maxCount,
    timeRange,
    totalFeatures
  };
}

/**
 * Generate histogram for specific filter criteria (main API function)
 */
export async function generateFilteredHistogram(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  request: HistogramRequest
): Promise<HistogramApiResponse> {
  
  const startTime = Date.now();
  
  try {
    const accumulator = createHistogramAccumulator(request);
    
    console.log(`📊 Generating filtered histogram:`);
    console.log(`   Record types: [${(request.recordTypes || []).join(', ') || 'all'}]`);
    console.log(`   Tags: [${(request.tags || []).join(', ')}]`);
    console.log(`   Time periods: ${request.timeSlices.length}`);
    
    // Process each time period
    for (const timeSlice of request.timeSlices) {
      await accumulateHistogramForPeriod(
        config,
        bounds,
        chunkConfig,
        timeSlice,
        accumulator
      );
    }
    
    console.log(`✅ Completed histogram generation:`);
    console.log(`   - Periods processed: ${request.timeSlices.length}`);
    console.log(`   - Periods with matching data: ${accumulator.bins.size}`);
    console.log(`   - Max count in any period: ${accumulator.maxCount}`);
    
    // Generate final histogram
    const histogram = generateHistogram(accumulator);
    const processingTime = Date.now() - startTime;
    
    return {
      histogram,
      success: true,
      processingTime
    };
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Failed to generate histogram:`, error);
    
    return {
      histogram: {
        bins: [],
        recordTypes: request.recordTypes,
        tags: request.tags,
        bounds: request.bounds,
        maxCount: 0,
        timeRange: { start: '', end: '' },
        totalFeatures: 0
      },
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      processingTime
    };
  }
}

/**
 * Generate histogram from existing HeatmapTimeline (faster, no API calls)
 */
export function generateHistogramFromHeatmapTimeline(
  heatmapTimeline: any, // HeatmapTimeline type
  request: HistogramRequest
): Histogram {
  
  console.log(`📊 Generating filtered histogram from HeatmapTimeline data`);
  
  const accumulator = createHistogramAccumulator(request);
  
  // Process each time slice from the heatmap timeline
  for (const timeSlice of request.timeSlices) {
    const timeSliceData = heatmapTimeline[timeSlice.key];
    const bin = createEmptyHistogramBin(timeSlice);
    
    if (timeSliceData) {
      // If filtering by record type, only look at that type
      const recordTypesToProcess = request.recordTypes 
        ? request.recordTypes
        : ['text', 'image', 'event'] as RecordType[];
      
      for (const recordType of recordTypesToProcess) {
        if (timeSliceData[recordType]) {
          const recordTypeData = timeSliceData[recordType];
          
          // If filtering by tags, use tag-specific heatmap
          if (request.tags && request.tags.length > 0) {
            // For multiple tags, we'd need intersection logic
            // For now, handle single tag case
            const tag = request.tags[0];
            if (recordTypeData.tags[tag]) {
              const tagCount = recordTypeData.tags[tag].countArray.reduce(
                (sum: number, count: number) => sum + count, 0
              );
              bin.count += tagCount;
            }
          } else {
            // No tag filter, use base heatmap
            const recordTypeCount = recordTypeData.base.countArray.reduce(
              (sum: number, count: number) => sum + count, 0
            );
            bin.count += recordTypeCount;
          }
        }
      }
    }
    
    // Always add the bin (even if count is 0) to ensure consistent timeline
    accumulator.maxCount = Math.max(accumulator.maxCount, bin.count);
    accumulator.bins.set(timeSlice.key, bin);
  }
  
  console.log(`✅ Generated filtered histogram from HeatmapTimeline: ${accumulator.bins.size} periods`);
  
  return generateHistogram(accumulator);
}

/**
 * Convenience functions for common API patterns
 */

// /getHistogram?recordType=text
export async function getHistogramByRecordType(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  recordType: RecordType,
  timeSlices: TimeSlice[]
): Promise<HistogramApiResponse> {
  return generateFilteredHistogram(config, bounds, chunkConfig, {
    recordTypes: [recordType],
    timeSlices
  });
}

// /getHistogram?recordType=text&tags=politics
export async function getHistogramByRecordTypeAndTags(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  recordType: RecordType,
  tags: string[],
  timeSlices: TimeSlice[]
): Promise<HistogramApiResponse> {
  return generateFilteredHistogram(config, bounds, chunkConfig, {
    recordTypes: [recordType],
    tags,
    timeSlices
  });
}

// /getHistogram?tags=politics (all record types)
export async function getHistogramByTags(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  tags: string[],
  timeSlices: TimeSlice[]
): Promise<HistogramApiResponse> {
  return generateFilteredHistogram(config, bounds, chunkConfig, {
    tags,
    timeSlices
  });
}

// /getHistogram (no filters - all data)
export async function getHistogramAll(
  config: DatabaseConfig,
  bounds: HeatmapCellBounds,
  chunkConfig: ChunkingConfig,
  timeSlices: TimeSlice[]
): Promise<HistogramApiResponse> {
  return generateFilteredHistogram(config, bounds, chunkConfig, {
    timeSlices
  });
}

/**
 * Analyze histogram data for insights
 */
export function analyzeHistogram(histogram: Histogram): {
  totalFeatures: number;
  totalPeriods: number;
  peakPeriod: { timeSlice: TimeSlice; count: number };
  averagePerPeriod: number;
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  growthRate: number; // Features per year
} {
  const totalFeatures = histogram.totalFeatures;
  const totalPeriods = histogram.bins.length;
  
  const peakBin = histogram.bins.reduce((max, bin) => 
    bin.count > max.count ? bin : max, 
    histogram.bins[0] || { timeSlice: {} as TimeSlice, count: 0 }
  );
  
  // Calculate trend direction and growth rate
  let trendDirection: 'increasing' | 'decreasing' | 'stable' = 'stable';
  let growthRate = 0;
  
  if (histogram.bins.length > 1) {
    const firstPeriod = histogram.bins[0];
    const lastPeriod = histogram.bins[histogram.bins.length - 1];
    const totalYears = lastPeriod.timeSlice.endYear - firstPeriod.timeSlice.startYear;
    
    if (totalYears > 0) {
      growthRate = (lastPeriod.count - firstPeriod.count) / totalYears;
      
      if (growthRate > 0.1) trendDirection = 'increasing';
      else if (growthRate < -0.1) trendDirection = 'decreasing';
      else trendDirection = 'stable';
    }
  }
  
  return {
    totalFeatures,
    totalPeriods,
    peakPeriod: { timeSlice: peakBin.timeSlice, count: peakBin.count },
    averagePerPeriod: Math.round(totalFeatures / (totalPeriods || 1)),
    trendDirection,
    growthRate
  };
}

/**
 * Filter histogram by time range (post-processing)
 */
export function filterHistogramByTimeRange(
  histogram: Histogram,
  startYear: number,
  endYear: number
): Histogram {
  const filteredBins = histogram.bins.filter(bin => 
    bin.timeSlice.startYear >= startYear &&
    bin.timeSlice.endYear <= endYear
  );
  
  const maxCount = Math.max(...filteredBins.map(bin => bin.count), 0);
  const totalFeatures = filteredBins.reduce((sum, bin) => sum + bin.count, 0);
  
  const timeRange = filteredBins.length > 0 ? {
    start: filteredBins[0].timeSlice.timeRange.start,
    end: filteredBins[filteredBins.length - 1].timeSlice.timeRange.end
  } : { start: '', end: '' };
  
  return {
    ...histogram,
    bins: filteredBins,
    maxCount,
    totalFeatures,
    timeRange
  };
}

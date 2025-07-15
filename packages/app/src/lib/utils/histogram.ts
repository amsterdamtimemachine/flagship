import type { Histogram, HistogramBin, RecordType } from '@atm/shared/types';

/**
 * Merge multiple histograms into a single histogram by combining bins and recalculating metadata
 * All histograms must have the same temporal alignment (same time periods)
 * 
 * @param histograms Array of histograms to merge
 * @returns Single merged histogram with combined data
 */
export function mergeHistograms(histograms: Histogram[]): Histogram {
  if (histograms.length === 0) {
    return {
      bins: [],
      maxCount: 0,
      timeRange: { start: '', end: '' },
      totalFeatures: 0
    };
  }

  if (histograms.length === 1) {
    return histograms[0];
  }

  // Create a map to accumulate counts by time slice key
  const binMap = new Map<string, HistogramBin>();
  
  // Collect all recordTypes and tags
  const allRecordTypes = new Set<RecordType>();
  const allTags = new Set<string>();
  
  // Initialize time range with first histogram
  let earliestStart = histograms[0].timeRange.start;
  let latestEnd = histograms[0].timeRange.end;

  // Process each histogram
  for (const histogram of histograms) {
    // Collect metadata
    if (histogram.recordTypes) {
      histogram.recordTypes.forEach(type => allRecordTypes.add(type));
    }
    if (histogram.tags) {
      histogram.tags.forEach(tag => allTags.add(tag));
    }

    // Update time range
    if (histogram.timeRange.start < earliestStart) {
      earliestStart = histogram.timeRange.start;
    }
    if (histogram.timeRange.end > latestEnd) {
      latestEnd = histogram.timeRange.end;
    }

    // Merge bins
    for (const bin of histogram.bins) {
      const timeSliceKey = bin.timeSlice.key;
      
      if (binMap.has(timeSliceKey)) {
        // Add to existing bin
        const existingBin = binMap.get(timeSliceKey)!;
        existingBin.count += bin.count;
      } else {
        // Create new bin (copy timeSlice object)
        binMap.set(timeSliceKey, {
          timeSlice: bin.timeSlice,
          count: bin.count
        });
      }
    }
  }

  // Convert map back to array and calculate final values
  const mergedBins = Array.from(binMap.values());
  const maxCount = Math.max(...mergedBins.map(bin => bin.count));
  const totalFeatures = mergedBins.reduce((sum, bin) => sum + bin.count, 0);

  return {
    bins: mergedBins,
    recordTypes: Array.from(allRecordTypes),
    tags: Array.from(allTags),
    maxCount,
    timeRange: { start: earliestStart, end: latestEnd },
    totalFeatures
  };
}
// src/lib/server/api-service.ts
import type { 
  RecordType, 
  Histogram, 
  HeatmapTimeline, 
  HistogramApiResponse,
  HeatmapTimelineApiResponse,
  Histograms,
  HeatmapResolutions
} from "@atm/shared/types";
import { VisualizationBinaryHandler } from "./binaryHandler";

export class VisualizationApiService {
  private binaryHandler: VisualizationBinaryHandler;
  private initialized = false;

  constructor(binaryPath: string) {
    this.binaryHandler = new VisualizationBinaryHandler(binaryPath);
  }

  async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.binaryHandler.initialize();
      this.initialized = true;
      console.log("✅ VisualizationApiService initialized");
    }
  }

  /**
   * Merge multiple histograms into a single histogram
   */
  private mergeHistograms(histograms: Histogram[]): Histogram {
    if (histograms.length === 0) {
      throw new Error('No histograms to merge');
    }
    
    if (histograms.length === 1) {
      return histograms[0];
    }

    const merged: Histogram = {
      bins: [],
      maxCount: 0,
      timeRange: histograms[0].timeRange,
      totalFeatures: 0
    };

    // Merge bins by period
    const binMap = new Map<string, number>();
    
    for (const histogram of histograms) {
      merged.totalFeatures += histogram.totalFeatures;
      merged.maxCount = Math.max(merged.maxCount, histogram.maxCount);
      
      for (const bin of histogram.bins) {
        const existing = binMap.get(bin.period) || 0;
        binMap.set(bin.period, existing + bin.count);
      }
    }

    // Convert map back to bins array
    merged.bins = Array.from(binMap.entries()).map(([period, count]) => ({
      period,
      count
    }));

    // Update maxCount after merging
    merged.maxCount = Math.max(...merged.bins.map(bin => bin.count));

    return merged;
  }

  /**
   * Merge heatmap timelines across multiple recordTypes
   */
  private mergeHeatmapTimelines(timeline: HeatmapTimeline, recordTypes: RecordType[], tag?: string): HeatmapTimeline {
    const merged: HeatmapTimeline = {};
    
    for (const [timeSliceKey, timeSliceData] of Object.entries(timeline)) {
      const mergedTimeSlice: any = {};
      
      // Merge all recordTypes for this time slice
      for (const recordType of recordTypes) {
        const recordTypeData = timeSliceData[recordType];
        if (recordTypeData) {
          if (tag) {
            // Use tag-specific heatmap if available
            if (recordTypeData.tags[tag]) {
              mergedTimeSlice[recordType] = {
                base: recordTypeData.tags[tag],
                tags: { [tag]: recordTypeData.tags[tag] }
              };
            }
          } else {
            // Use base heatmap
            mergedTimeSlice[recordType] = recordTypeData;
          }
        }
      }
      
      // Only include time slices that have data for at least one recordType
      if (Object.keys(mergedTimeSlice).length > 0) {
        merged[timeSliceKey] = mergedTimeSlice;
      }
    }
    
    return merged;
  }

  /**
   * Get histogram for specific recordTypes and optional tags
   */
  async getHistogram(recordTypes: RecordType[], tags?: string[]): Promise<HistogramApiResponse> {
    const startTime = Date.now();

    try {
      await this.initialize();

      console.log(`📊 Fetching histogram for recordTypes: ${recordTypes.join(', ')}`);
      if (tags && tags.length > 0) {
        console.log(`🏷️ With tags: ${tags.join(', ')}`);
      }

      const histograms = await this.binaryHandler.readHistograms();
      
      // Validate all recordTypes exist
      const missingTypes = recordTypes.filter(type => !histograms[type]);
      if (missingTypes.length > 0) {
        throw new Error(`RecordTypes "${missingTypes.join(', ')}" not found in histograms data`);
      }

      let histogram: Histogram;

      if (!tags || tags.length === 0) {
        // Merge base histograms for all recordTypes
        histogram = this.mergeHistograms(recordTypes.map(type => histograms[type].base));
        console.log(`📈 Returning merged base histogram: ${histogram.totalFeatures} total features`);
      } else if (tags.length === 1) {
        // Single tag - merge specific tag histograms if available
        const tag = tags[0];
        const tagHistograms = recordTypes.map(type => {
          const typeTagHistograms = histograms[type].tags;
          if (!typeTagHistograms[tag]) {
            throw new Error(`Tag "${tag}" not found for recordType "${type}"`);
          }
          return typeTagHistograms[tag];
        });
        
        histogram = this.mergeHistograms(tagHistograms);
        console.log(`📈 Returning merged tag histogram for "${tag}": ${histogram.totalFeatures} total features`);
      } else {
        // Multiple tags - for now, return error as we don't have intersection logic
        throw new Error("Multiple tags filtering not yet implemented");
      }

      const processingTime = Date.now() - startTime;

      return {
        histogram: this.binaryHandler.prepareForJsonResponse(histogram),
        recordTypes,
        tags,
        success: true,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Failed to get histogram:`, error);

      return {
        histogram: {
          bins: [],
          maxCount: 0,
          timeRange: { start: '', end: '' },
          totalFeatures: 0
        },
        recordTypes,
        tags,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      };
    }
  }

  /**
   * Get HeatmapTimeline for a specific recordType and optional tags
   * Always returns all periods at single resolution (first available resolution)
   */
  async getHeatmapTimeline(recordTypes: RecordType[], tags?: string[]): Promise<HeatmapTimelineApiResponse> {
    const startTime = Date.now();

    try {
      await this.initialize();

      console.log(`🔥 Fetching heatmap timeline for recordTypes: ${recordTypes.join(', ')}`);
      if (tags && tags.length > 0) {
        console.log(`🏷️ With tags: ${tags.join(', ')}`);
      }

      const heatmapResolutions = await this.binaryHandler.readHeatmaps();
      const metadata = this.binaryHandler.getMetadata();

      // Get first available resolution
      const resolutionKeys = Object.keys(heatmapResolutions);
      if (resolutionKeys.length === 0) {
        throw new Error("No heatmap resolutions available");
      }

      const selectedResolution = resolutionKeys[0]; // Use first resolution
      const heatmapTimeline = heatmapResolutions[selectedResolution];

      console.log(`📐 Using resolution: ${selectedResolution}`);
      console.log(`📅 Available time periods: ${Object.keys(heatmapTimeline).length}`);

      // Validate that all recordTypes exist in the data
      const firstTimeSlice = Object.values(heatmapTimeline)[0];
      const missingTypes = recordTypes.filter(type => !firstTimeSlice || !firstTimeSlice[type]);
      if (missingTypes.length > 0) {
        throw new Error(`RecordTypes "${missingTypes.join(', ')}" not found in heatmap data`);
      }

      // If tags are specified, we need to filter/modify the timeline
      let resultTimeline: HeatmapTimeline;

      if (!tags || tags.length === 0) {
        // Return merged timeline with base heatmaps for all recordTypes
        resultTimeline = this.mergeHeatmapTimelines(heatmapTimeline, recordTypes);
        console.log(`🔥 Returning merged base heatmap timeline for recordTypes "${recordTypes.join(', ')}": ${Object.keys(resultTimeline).length} periods`);
      } else if (tags.length === 1) {
        // Single tag - create timeline with tag-specific heatmaps merged across recordTypes
        const tag = tags[0];
        resultTimeline = this.mergeHeatmapTimelines(heatmapTimeline, recordTypes, tag);
        
        if (Object.keys(resultTimeline).length === 0) {
          throw new Error(`Tag "${tag}" not found for recordTypes "${recordTypes.join(', ')}" in any time period`);
        }
        
        console.log(`🏷️ Returning tag-filtered merged timeline for "${tag}": ${Object.keys(resultTimeline).length} periods`);
      } else {
        // Multiple tags - not implemented yet
        throw new Error("Multiple tags filtering not yet implemented");
      }

      const processingTime = Date.now() - startTime;

      return {
        heatmapTimeline: this.binaryHandler.prepareForJsonResponse(resultTimeline),
        recordTypes,
        tags,
        resolution: selectedResolution,
        success: true,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Failed to get heatmap timeline:`, error);

      return {
        heatmapTimeline: {},
        recordTypes,
        tags,
        resolution: '',
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      };
    }
  }

  /**
   * Get available metadata for the client
   */
  async getVisualizationMetadata() {
    await this.initialize();
    const metadata = this.binaryHandler.getMetadata();
    
    // Return relevant metadata for the client
    return {
      timeSlices: metadata.timeSlices,
      timeRange: metadata.timeRange,
      recordTypes: metadata.recordTypes,
      tags: metadata.tags,
      resolutions: metadata.resolutions,
      heatmapDimensions: metadata.heatmapDimensions,
      heatmapBlueprint: metadata.heatmapBlueprint,
      stats: metadata.stats
    };
  }
}

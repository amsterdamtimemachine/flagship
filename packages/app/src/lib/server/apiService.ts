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
   * Get histogram for a specific recordType and optional tags
   */
  async getHistogram(recordType: RecordType, tags?: string[]): Promise<HistogramApiResponse> {
    const startTime = Date.now();

    try {
      await this.initialize();

      console.log(`📊 Fetching histogram for recordType: ${recordType}`);
      if (tags && tags.length > 0) {
        console.log(`🏷️ With tags: ${tags.join(', ')}`);
      }

      const histograms = await this.binaryHandler.readHistograms();
      
      if (!histograms[recordType]) {
        throw new Error(`RecordType "${recordType}" not found in histograms data`);
      }

      let histogram: Histogram;

      if (!tags || tags.length === 0) {
        // Return base histogram for the recordType
        histogram = histograms[recordType].base;
        console.log(`📈 Returning base histogram: ${histogram.totalFeatures} total features`);
      } else if (tags.length === 1) {
        // Single tag - return specific tag histogram if available
        const tag = tags[0];
        const tagHistograms = histograms[recordType].tags;
        
        if (tagHistograms[tag]) {
          histogram = tagHistograms[tag];
          console.log(`📈 Returning tag histogram for "${tag}": ${histogram.totalFeatures} total features`);
        } else {
          throw new Error(`Tag "${tag}" not found for recordType "${recordType}"`);
        }
      } else {
        // Multiple tags - for now, return error as we don't have intersection logic
        throw new Error("Multiple tags filtering not yet implemented");
      }

      const processingTime = Date.now() - startTime;

      return {
        histogram: this.binaryHandler.prepareForJsonResponse(histogram),
        success: true,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Failed to get histogram:`, error);

      return {
        histogram: {
          bins: [],
          recordType,
          tags,
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
   * Get HeatmapTimeline for a specific recordType and optional tags
   * Always returns all periods at single resolution (first available resolution)
   */
  async getHeatmapTimeline(recordType: RecordType, tags?: string[]): Promise<HeatmapTimelineApiResponse> {
    const startTime = Date.now();

    try {
      await this.initialize();

      console.log(`🔥 Fetching heatmap timeline for recordType: ${recordType}`);
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

      // Validate that the recordType exists in the data
      const firstTimeSlice = Object.values(heatmapTimeline)[0];
      if (!firstTimeSlice || !firstTimeSlice[recordType]) {
        throw new Error(`RecordType "${recordType}" not found in heatmap data`);
      }

      // If tags are specified, we need to filter/modify the timeline
      let resultTimeline: HeatmapTimeline;

      if (!tags || tags.length === 0) {
        // Return full timeline with base heatmaps for this recordType
        resultTimeline = heatmapTimeline;
        console.log(`🔥 Returning base heatmap timeline for recordType "${recordType}"`);
      } else if (tags.length === 1) {
        // Single tag - create timeline with tag-specific heatmaps
        const tag = tags[0];
        resultTimeline = {};
        
        for (const [timeSliceKey, timeSliceData] of Object.entries(heatmapTimeline)) {
          const recordTypeData = timeSliceData[recordType];
          if (recordTypeData && recordTypeData.tags[tag]) {
            // Create a timeline with only the requested recordType and tag
            resultTimeline[timeSliceKey] = {
              [recordType]: {
                base: recordTypeData.tags[tag], // Use tag heatmap as base
                tags: { [tag]: recordTypeData.tags[tag] }
              }
            } as any;
          }
        }
        
        if (Object.keys(resultTimeline).length === 0) {
          throw new Error(`Tag "${tag}" not found for recordType "${recordType}" in any time period`);
        }
        
        console.log(`🏷️ Returning tag-filtered timeline for "${tag}": ${Object.keys(resultTimeline).length} periods`);
      } else {
        // Multiple tags - not implemented yet
        throw new Error("Multiple tags filtering not yet implemented");
      }

      const processingTime = Date.now() - startTime;

      return {
        heatmapTimeline: this.binaryHandler.prepareForJsonResponse(resultTimeline),
        recordType,
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
        recordType,
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

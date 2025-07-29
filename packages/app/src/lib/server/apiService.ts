// src/lib/server/api-service.ts
import type { 
  RecordType, 
  Histogram, 
  HeatmapTimeline, 
  HistogramApiResponse,
  HeatmapTimelineApiResponse,
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
   * Filter heatmap timeline to only include requested recordTypes (no merging on server)
   */
  private filterHeatmapTimelines(timeline: HeatmapTimeline, recordTypes: RecordType[], tag?: string): HeatmapTimeline {
    const filtered: HeatmapTimeline = {};
    
    for (const [timeSliceKey, timeSliceData] of Object.entries(timeline)) {
      const filteredTimeSlice: any = {};
      
      // Include only requested recordTypes for this time slice
      for (const recordType of recordTypes) {
        const recordTypeData = timeSliceData[recordType];
        if (recordTypeData) {
          if (tag) {
            // Use tag-specific heatmap if available
            if (recordTypeData.tags[tag]) {
              filteredTimeSlice[recordType] = {
                base: recordTypeData.tags[tag],
                tags: { [tag]: recordTypeData.tags[tag] }
              };
            }
          } else {
            // Use full recordType data (base + all tags)
            filteredTimeSlice[recordType] = recordTypeData;
          }
        }
      }
      
      // Only include time slices that have data for at least one recordType
      if (Object.keys(filteredTimeSlice).length > 0) {
        filtered[timeSliceKey] = filteredTimeSlice;
      }
    }
    
    return filtered;
  }

  /**
   * Get histogram for specific recordTypes and optional tags
   * If no recordTypes provided, defaults to all available recordTypes
   */
  async getHistogram(recordTypes?: RecordType[], tags?: string[]): Promise<HistogramApiResponse> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Default to all recordTypes if none provided
      if (!recordTypes || recordTypes.length === 0) {
        const metadata = this.binaryHandler.getMetadata();
        recordTypes = metadata.recordTypes;
        console.log(`📊 No recordTypes specified, defaulting to all: ${recordTypes.join(', ')}`);
      }
      
      console.log(`📊 Fetching histogram data for recordTypes: ${recordTypes.join(', ')}`);
      if (tags && tags.length > 0) {
        console.log(`🏷️ With tags: ${tags.join(', ')}`);
      }

      const histograms = await this.binaryHandler.readHistograms();
      
      // Validate all recordTypes exist
      const missingTypes = recordTypes.filter(type => !histograms[type]);
      if (missingTypes.length > 0) {
        throw new Error(`RecordTypes "${missingTypes.join(', ')}" not found in histograms data`);
      }

      // Return raw histogram data for client-side merging
      const histogramData: { [key: string]: any } = {};
      
      for (const recordType of recordTypes) {
        if (!tags || tags.length === 0) {
          // Include base histogram
          histogramData[recordType] = {
            base: histograms[recordType].base,
            tags: histograms[recordType].tags
          };
        } else if (tags.length === 1) {
          // Include specific tag histogram
          const tag = tags[0];
          const tagHistograms = histograms[recordType].tags;
          
          if (!tagHistograms[tag]) {
            throw new Error(`Tag "${tag}" not found for recordType "${recordType}"`);
          }
          
          histogramData[recordType] = {
            base: histograms[recordType].base,
            tags: { [tag]: tagHistograms[tag] }
          };
        } else {
          // Multiple tags - not implemented yet
          throw new Error("Multiple tags filtering not yet implemented");
        }
      }
      
      console.log(`📊 Returning raw histogram data for ${recordTypes.length} recordTypes`);

      const processingTime = Date.now() - startTime;

      return {
        histograms: this.binaryHandler.prepareForJsonResponse(histogramData),
        recordTypes,
        tags,
        success: true,
        processingTime
      };

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`❌ Failed to get histogram:`, error);

      return {
        histograms: {},
        recordTypes,
        tags,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      };
    }
  }

  /**
   * Get HeatmapTimeline for specific recordTypes and optional tags
   * If no recordTypes provided, defaults to all available recordTypes
   * Always returns all periods at single resolution (first available resolution)
   */
  async getHeatmapTimeline(recordTypes?: RecordType[], tags?: string[]): Promise<HeatmapTimelineApiResponse> {
    const startTime = Date.now();

    try {
      await this.initialize();

      // Default to all recordTypes if none provided
      if (!recordTypes || recordTypes.length === 0) {
        const metadata = this.binaryHandler.getMetadata();
        recordTypes = metadata.recordTypes;
        console.log(`🔥 No recordTypes specified, defaulting to all: ${recordTypes.join(', ')}`);
      }
      
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

      // Validate that all recordTypes exist in at least one time slice
      const allRecordTypesInHeatmap = new Set<string>();
      Object.values(heatmapTimeline).forEach(timeSlice => {
        Object.keys(timeSlice).forEach(recordType => {
          allRecordTypesInHeatmap.add(recordType);
        });
      });
      
      const missingTypes = recordTypes.filter(type => !allRecordTypesInHeatmap.has(type));
      if (missingTypes.length > 0) {
        throw new Error(`RecordTypes "${missingTypes.join(', ')}" not found in heatmap data`);
      }

      // If tags are specified, we need to filter/modify the timeline
      let resultTimeline: HeatmapTimeline;

      if (!tags || tags.length === 0) {
        // Return filtered timeline with individual recordType keys (client will merge)
        resultTimeline = this.filterHeatmapTimelines(heatmapTimeline, recordTypes);
        console.log(`🔥 Returning filtered heatmap timeline for recordTypes "${recordTypes.join(', ')}": ${Object.keys(resultTimeline).length} periods`);
      } else if (tags.length === 1) {
        // Single tag - return filtered timeline with tag-specific heatmaps  
        const tag = tags[0];
        resultTimeline = this.filterHeatmapTimelines(heatmapTimeline, recordTypes, tag);
        
        if (Object.keys(resultTimeline).length === 0) {
          throw new Error(`Tag "${tag}" not found for recordTypes "${recordTypes.join(', ')}" in any time period`);
        }
        
        console.log(`🏷️ Returning tag-filtered timeline for "${tag}": ${Object.keys(resultTimeline).length} periods`);
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

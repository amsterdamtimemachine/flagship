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
import { mergeHistograms } from "../utils/histogram";

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

      if (recordTypes.length === 1) {
        // Single recordType - return directly without merging
        const recordType = recordTypes[0];
        
        if (!tags || tags.length === 0) {
          // Return base histogram
          histogram = histograms[recordType].base;
          console.log(`📈 Returning base histogram for "${recordType}": ${histogram.totalFeatures} total features`);
        } else if (tags.length === 1) {
          // Single tag - return specific tag histogram
          const tag = tags[0];
          const tagHistograms = histograms[recordType].tags;
          
          if (!tagHistograms[tag]) {
            throw new Error(`Tag "${tag}" not found for recordType "${recordType}"`);
          }
          
          histogram = tagHistograms[tag];
          console.log(`📈 Returning tag histogram for "${recordType}" with tag "${tag}": ${histogram.totalFeatures} total features`);
        } else {
          // Multiple tags - not implemented yet
          throw new Error("Multiple tags filtering not yet implemented");
        }
      } else {
        // Multiple recordTypes - merge histograms
        if (!tags || tags.length === 0) {
          // Merge base histograms for all recordTypes
          const baseHistograms = recordTypes.map(type => histograms[type].base);
          histogram = mergeHistograms(baseHistograms);
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
          
          histogram = mergeHistograms(tagHistograms);
          console.log(`📈 Returning merged tag histogram for "${tag}": ${histogram.totalFeatures} total features`);
        } else {
          // Multiple tags - for now, return error as we don't have intersection logic
          throw new Error("Multiple tags filtering not yet implemented");
        }
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

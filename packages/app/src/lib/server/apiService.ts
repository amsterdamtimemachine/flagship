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
            } else {
              // Tag doesn't exist - create empty heatmap with same structure as base
              const baseHeatmap = recordTypeData.base;
              const emptyHeatmap = {
                countArray: new Array(baseHeatmap.countArray.length).fill(0),
                densityArray: new Array(baseHeatmap.densityArray.length).fill(0)
              };
              
              filteredTimeSlice[recordType] = {
                base: emptyHeatmap,
                tags: { [tag]: emptyHeatmap }
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
            // Tag doesn't exist - create empty histogram with same structure as base
            const baseHistogram = histograms[recordType].base;
            const emptyHistogram = {
              bins: baseHistogram.bins.map(bin => ({
                timeSlice: bin.timeSlice,
                count: 0
              })),
              maxCount: 0,
              timeRange: baseHistogram.timeRange,
              totalFeatures: 0
            };
            
            histogramData[recordType] = {
              base: histograms[recordType].base,
              tags: { [tag]: emptyHistogram }
            };
          } else {
            histogramData[recordType] = {
              base: histograms[recordType].base,
              tags: { [tag]: tagHistograms[tag] }
            };
          }
        } else {
          // Multiple tags - use combination key
          const comboKey = tags.sort().join('+');
          const tagHistograms = histograms[recordType].tags;
          
          if (!tagHistograms[comboKey]) {
            // Combination doesn't exist - create empty histogram with same structure as base
            const baseHistogram = histograms[recordType].base;
            const emptyHistogram = {
              bins: baseHistogram.bins.map(bin => ({
                timeSlice: bin.timeSlice,
                count: 0
              })),
              maxCount: 0,
              timeRange: baseHistogram.timeRange,
              totalFeatures: 0
            };
            
            histogramData[recordType] = {
              base: histograms[recordType].base,
              tags: { [comboKey]: emptyHistogram }
            };
          } else {
            histogramData[recordType] = {
              base: histograms[recordType].base,
              tags: { [comboKey]: tagHistograms[comboKey] }
            };
          }
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
        
        // No need to throw error - empty timeline is valid (shows empty visualization)
        
        console.log(`🏷️ Returning tag-filtered timeline for "${tag}": ${Object.keys(resultTimeline).length} periods`);
      } else {
        // Multiple tags - use combination key
        const comboKey = tags.sort().join('+');
        resultTimeline = this.filterHeatmapTimelines(heatmapTimeline, recordTypes, comboKey);
        
        // No need to throw error - empty timeline is valid (shows empty visualization)
        
        console.log(`🏷️ Returning tag-combination-filtered timeline for "${comboKey}": ${Object.keys(resultTimeline).length} periods`);
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
   * Get tags that have data for the specified recordTypes
   * Returns individual tags (not combinations) with feature counts
   */
  async getAvailableTags(recordTypes?: RecordType[]): Promise<{
    tags: Array<{ name: string; totalFeatures: number; recordTypes: RecordType[] }>;
    recordTypes: RecordType[];
    success: boolean;
    message?: string;
  }> {
    try {
      await this.initialize();

      // Default to all recordTypes if none provided
      if (!recordTypes || recordTypes.length === 0) {
        const metadata = this.binaryHandler.getMetadata();
        recordTypes = metadata.recordTypes;
      }

      console.log(`🏷️ Getting available tags for recordTypes: ${recordTypes.join(', ')}`);

      const histograms = await this.binaryHandler.readHistograms();
      
      // Track tags across all requested recordTypes
      const tagStats = new Map<string, { totalFeatures: number; recordTypes: Set<RecordType> }>();

      for (const recordType of recordTypes) {
        const recordTypeData = histograms[recordType];
        if (!recordTypeData) continue;

        // Process all tags for this recordType
        for (const [tagKey, histogram] of Object.entries(recordTypeData.tags)) {
          // Skip combination tags (contain '+')
          if (tagKey.includes('+')) continue;

          // Initialize or update tag stats
          if (!tagStats.has(tagKey)) {
            tagStats.set(tagKey, { totalFeatures: 0, recordTypes: new Set() });
          }

          const stats = tagStats.get(tagKey)!;
          stats.totalFeatures += histogram.totalFeatures;
          stats.recordTypes.add(recordType);
        }
      }

      // Convert to response format, filter out zero-feature tags
      const availableTags = Array.from(tagStats.entries())
        .filter(([_, stats]) => stats.totalFeatures > 0)
        .map(([tagName, stats]) => ({
          name: tagName,
          totalFeatures: stats.totalFeatures,
          recordTypes: Array.from(stats.recordTypes).sort()
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically

      console.log(`✅ Found ${availableTags.length} available tags with data`);

      return {
        tags: availableTags,
        recordTypes,
        success: true
      };

    } catch (error) {
      console.error(`❌ Failed to get available tags:`, error);
      return {
        tags: [],
        recordTypes: recordTypes || [],
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Validate a tag combination against precomputed data
   * Returns which tags are valid and which are invalid
   */
  async validateTagCombination(recordTypes?: RecordType[], selectedTags: string[] = []): Promise<{
    validTags: string[];
    invalidTags: string[];
    success: boolean;
    message?: string;
  }> {
    try {
      await this.initialize();

      // Default to all recordTypes if none provided
      if (!recordTypes || recordTypes.length === 0) {
        const metadata = this.binaryHandler.getMetadata();
        recordTypes = metadata.recordTypes;
      }

      console.log(`🔍 Validating tag combination: ${selectedTags.join(', ')} for recordTypes: ${recordTypes.join(', ')}`);

      // Single tags are always valid (they exist as individual tags)
      if (selectedTags.length <= 1) {
        return {
          validTags: selectedTags,
          invalidTags: [],
          success: true
        };
      }

      // Check if this exact combination exists in precomputed data
      const comboKey = selectedTags.sort().join('+');
      const histograms = await this.binaryHandler.readHistograms();
      
      let combinationExists = false;
      
      // Check if combination exists for any of the specified record types
      for (const recordType of recordTypes) {
        const recordTypeData = histograms[recordType];
        if (recordTypeData?.tags[comboKey]) {
          combinationExists = true;
          console.log(`✅ Combination "${comboKey}" exists for recordType: ${recordType}`);
          break;
        }
      }

      if (combinationExists) {
        return {
          validTags: selectedTags,
          invalidTags: [],
          success: true
        };
      } else {
        console.log(`❌ Combination "${comboKey}" does not exist in precomputed data`);
        
        return {
          validTags: [],
          invalidTags: selectedTags,
          success: true
        };
      }

    } catch (error) {
      console.error(`❌ Failed to validate tag combination:`, error);
      return {
        validTags: [],
        invalidTags: selectedTags,
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get tag combinations that extend the current selection
   * Returns tags that can be added to form valid combinations
   */
  async getTagCombinations(recordTypes?: RecordType[], selectedTags: string[] = []): Promise<{
    availableTags: Array<{ name: string; totalFeatures: number }>;
    currentSelection: string[];
    recordTypes: RecordType[];
    success: boolean;
    message?: string;
  }> {
    try {
      await this.initialize();

      // Default to all recordTypes if none provided
      if (!recordTypes || recordTypes.length === 0) {
        const metadata = this.binaryHandler.getMetadata();
        recordTypes = metadata.recordTypes;
      }

      console.log(`🔗 Getting tag combinations for recordTypes: ${recordTypes.join(', ')}, selected: ${selectedTags.join(', ')}`);

      const histograms = await this.binaryHandler.readHistograms();
      
      // Track available next tags with their feature counts
      const nextTagStats = new Map<string, number>();

      for (const recordType of recordTypes) {
        const recordTypeData = histograms[recordType];
        if (!recordTypeData) continue;

        const tagKeys = Object.keys(recordTypeData.tags);

        if (selectedTags.length === 0) {
          // No selection - return all individual tags (same as available-tags but with structure)
          for (const tagKey of tagKeys) {
            if (tagKey.includes('+')) continue; // Skip combinations
            
            const histogram = recordTypeData.tags[tagKey];
            const currentCount = nextTagStats.get(tagKey) || 0;
            nextTagStats.set(tagKey, currentCount + histogram.totalFeatures);
          }
        } else {
          // Find combinations that extend current selection
          const validCombinations = tagKeys.filter(key => {
            if (!key.includes('+')) return false; // Must be a combination
            
            const keyTags = key.split('+').sort();
            
            // Check if combination contains all selected tags and exactly one more
            const hasAllSelected = selectedTags.every(tag => keyTags.includes(tag));
            const isNextLevel = keyTags.length === selectedTags.length + 1;
            
            return hasAllSelected && isNextLevel;
          });

          // Extract the "next" tags from valid combinations
          for (const combo of validCombinations) {
            const comboTags = combo.split('+');
            const nextTags = comboTags.filter(tag => !selectedTags.includes(tag));
            
            for (const nextTag of nextTags) {
              const histogram = recordTypeData.tags[combo];
              const currentCount = nextTagStats.get(nextTag) || 0;
              nextTagStats.set(nextTag, currentCount + histogram.totalFeatures);
            }
          }
        }
      }

      // Convert to response format
      const availableTags = Array.from(nextTagStats.entries())
        .filter(([_, count]) => count > 0)
        .map(([tagName, totalFeatures]) => ({
          name: tagName,
          totalFeatures
        }))
        .sort((a, b) => a.name.localeCompare(b.name));

      console.log(`✅ Found ${availableTags.length} available next tags for current selection`);

      return {
        availableTags,
        currentSelection: selectedTags,
        recordTypes,
        success: true
      };

    } catch (error) {
      console.error(`❌ Failed to get tag combinations:`, error);
      return {
        availableTags: [],
        currentSelection: selectedTags,
        recordTypes: recordTypes || [],
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error'
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

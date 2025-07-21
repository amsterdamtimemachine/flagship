import { decode } from "@msgpack/msgpack";
class VisualizationBinaryHandler {
  constructor(binaryPath) {
    this.binaryPath = binaryPath;
  }
  binaryBuffer = null;
  metadata = null;
  dataStartOffset = 0;
  async initialize() {
    try {
      if (!this.binaryBuffer) {
        console.log("🔥 Opening binary file with memory mapping...");
        let buffer;
        if (typeof Bun !== "undefined") {
          const mmap = Bun.mmap(this.binaryPath);
          buffer = mmap.buffer;
        } else {
          const fs = await import("fs/promises");
          const fileBuffer = await fs.readFile(this.binaryPath);
          buffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength);
        }
        this.binaryBuffer = buffer;
        console.log(`📊 Buffer size: ${buffer.byteLength} bytes`);
        if (buffer.byteLength < 4) {
          throw new Error("Binary file too small - missing metadata size");
        }
        const dataView = new DataView(buffer);
        const metadataSize = dataView.getUint32(0, false);
        console.log(`📋 Metadata size: ${metadataSize} bytes`);
        if (buffer.byteLength < 4 + metadataSize) {
          throw new Error(`Binary file truncated. Expected ${4 + metadataSize} bytes, got ${buffer.byteLength}`);
        }
        try {
          const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
          const metadata = decode(metadataBytes);
          this.metadata = metadata;
          this.dataStartOffset = 4 + metadataSize;
          console.log("✅ Successfully decoded metadata");
          console.log(`📊 Version: ${metadata.version}`);
          console.log(`🕒 TimeSlices: ${metadata.timeSlices.length}`);
          console.log(`📈 RecordTypes: ${metadata.recordTypes.join(", ")}`);
          console.log(`🏷️ Tags: ${metadata.tags.length}`);
          console.log(`📐 Resolutions: ${metadata.resolutions.length}`);
        } catch (error) {
          console.error("❌ Failed to decode metadata:", error);
          throw error;
        }
      }
    } catch (error) {
      console.error("❌ Failed to initialize binary data:", error);
      throw error;
    }
  }
  getMetadata() {
    if (!this.metadata) {
      throw new Error("Metadata not initialized");
    }
    return this.metadata;
  }
  async readHeatmaps() {
    if (!this.binaryBuffer || !this.metadata) {
      throw new Error("Binary handler not initialized");
    }
    const heatmapsSection = this.metadata.sections.heatmaps;
    const heatmapsBytes = new Uint8Array(
      this.binaryBuffer,
      this.dataStartOffset + heatmapsSection.offset,
      heatmapsSection.length
    );
    return decode(heatmapsBytes);
  }
  async readHistograms() {
    if (!this.binaryBuffer || !this.metadata) {
      throw new Error("Binary handler not initialized");
    }
    const histogramsSection = this.metadata.sections.histograms;
    const histogramsBytes = new Uint8Array(
      this.binaryBuffer,
      this.dataStartOffset + histogramsSection.offset,
      histogramsSection.length
    );
    return decode(histogramsBytes);
  }
  /**
   * Convert TypedArrays to regular arrays for JSON serialization
   */
  convertTypedArraysForSerialization(data) {
    if (data && typeof data === "object") {
      if (data.constructor && data.constructor.name.includes("Array") && data.constructor !== Array) {
        return Array.from(data);
      }
      if (Array.isArray(data)) {
        return data.map((item) => this.convertTypedArraysForSerialization(item));
      }
      const result = {};
      for (const [key, value] of Object.entries(data)) {
        result[key] = this.convertTypedArraysForSerialization(value);
      }
      return result;
    }
    return data;
  }
  /**
   * Prepare data for JSON response by converting TypedArrays
   */
  prepareForJsonResponse(data) {
    return this.convertTypedArraysForSerialization(data);
  }
}
function mergeHistograms(histograms) {
  if (histograms.length === 0) {
    return {
      bins: [],
      maxCount: 0,
      timeRange: { start: "", end: "" },
      totalFeatures: 0
    };
  }
  if (histograms.length === 1) {
    return histograms[0];
  }
  const binMap = /* @__PURE__ */ new Map();
  const allRecordTypes = /* @__PURE__ */ new Set();
  const allTags = /* @__PURE__ */ new Set();
  let earliestStart = histograms[0].timeRange.start;
  let latestEnd = histograms[0].timeRange.end;
  for (const histogram of histograms) {
    if (histogram.recordTypes) {
      histogram.recordTypes.forEach((type) => allRecordTypes.add(type));
    }
    if (histogram.tags) {
      histogram.tags.forEach((tag) => allTags.add(tag));
    }
    if (histogram.timeRange.start < earliestStart) {
      earliestStart = histogram.timeRange.start;
    }
    if (histogram.timeRange.end > latestEnd) {
      latestEnd = histogram.timeRange.end;
    }
    for (const bin of histogram.bins) {
      const timeSliceKey = bin.timeSlice.key;
      if (binMap.has(timeSliceKey)) {
        const existingBin = binMap.get(timeSliceKey);
        existingBin.count += bin.count;
      } else {
        binMap.set(timeSliceKey, {
          timeSlice: bin.timeSlice,
          count: bin.count
        });
      }
    }
  }
  const mergedBins = Array.from(binMap.values());
  const maxCount = Math.max(...mergedBins.map((bin) => bin.count));
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
class VisualizationApiService {
  binaryHandler;
  initialized = false;
  constructor(binaryPath) {
    this.binaryHandler = new VisualizationBinaryHandler(binaryPath);
  }
  async initialize() {
    if (!this.initialized) {
      await this.binaryHandler.initialize();
      this.initialized = true;
      console.log("✅ VisualizationApiService initialized");
    }
  }
  /**
   * Merge heatmap timelines across multiple recordTypes
   */
  mergeHeatmapTimelines(timeline, recordTypes, tag) {
    const merged = {};
    for (const [timeSliceKey, timeSliceData] of Object.entries(timeline)) {
      const mergedTimeSlice = {};
      for (const recordType of recordTypes) {
        const recordTypeData = timeSliceData[recordType];
        if (recordTypeData) {
          if (tag) {
            if (recordTypeData.tags[tag]) {
              mergedTimeSlice[recordType] = {
                base: recordTypeData.tags[tag],
                tags: { [tag]: recordTypeData.tags[tag] }
              };
            }
          } else {
            mergedTimeSlice[recordType] = recordTypeData;
          }
        }
      }
      if (Object.keys(mergedTimeSlice).length > 0) {
        merged[timeSliceKey] = mergedTimeSlice;
      }
    }
    return merged;
  }
  /**
   * Get histogram for specific recordTypes and optional tags
   */
  async getHistogram(recordTypes, tags) {
    const startTime = Date.now();
    try {
      await this.initialize();
      console.log(`📊 Fetching histogram for recordTypes: ${recordTypes.join(", ")}`);
      if (tags && tags.length > 0) {
        console.log(`🏷️ With tags: ${tags.join(", ")}`);
      }
      const histograms = await this.binaryHandler.readHistograms();
      const missingTypes = recordTypes.filter((type) => !histograms[type]);
      if (missingTypes.length > 0) {
        throw new Error(`RecordTypes "${missingTypes.join(", ")}" not found in histograms data`);
      }
      let histogram;
      if (recordTypes.length === 1) {
        const recordType = recordTypes[0];
        if (!tags || tags.length === 0) {
          histogram = histograms[recordType].base;
          console.log(`📈 Returning base histogram for "${recordType}": ${histogram.totalFeatures} total features`);
        } else if (tags.length === 1) {
          const tag = tags[0];
          const tagHistograms = histograms[recordType].tags;
          if (!tagHistograms[tag]) {
            throw new Error(`Tag "${tag}" not found for recordType "${recordType}"`);
          }
          histogram = tagHistograms[tag];
          console.log(`📈 Returning tag histogram for "${recordType}" with tag "${tag}": ${histogram.totalFeatures} total features`);
        } else {
          throw new Error("Multiple tags filtering not yet implemented");
        }
      } else {
        if (!tags || tags.length === 0) {
          const baseHistograms = recordTypes.map((type) => histograms[type].base);
          histogram = mergeHistograms(baseHistograms);
          console.log(`📈 Returning merged base histogram: ${histogram.totalFeatures} total features`);
        } else if (tags.length === 1) {
          const tag = tags[0];
          const tagHistograms = recordTypes.map((type) => {
            const typeTagHistograms = histograms[type].tags;
            if (!typeTagHistograms[tag]) {
              throw new Error(`Tag "${tag}" not found for recordType "${type}"`);
            }
            return typeTagHistograms[tag];
          });
          histogram = mergeHistograms(tagHistograms);
          console.log(`📈 Returning merged tag histogram for "${tag}": ${histogram.totalFeatures} total features`);
        } else {
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
          timeRange: { start: "", end: "" },
          totalFeatures: 0
        },
        recordTypes,
        tags,
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        processingTime
      };
    }
  }
  /**
   * Get HeatmapTimeline for a specific recordType and optional tags
   * Always returns all periods at single resolution (first available resolution)
   */
  async getHeatmapTimeline(recordTypes, tags) {
    const startTime = Date.now();
    try {
      await this.initialize();
      console.log(`🔥 Fetching heatmap timeline for recordTypes: ${recordTypes.join(", ")}`);
      if (tags && tags.length > 0) {
        console.log(`🏷️ With tags: ${tags.join(", ")}`);
      }
      const heatmapResolutions = await this.binaryHandler.readHeatmaps();
      const metadata = this.binaryHandler.getMetadata();
      const resolutionKeys = Object.keys(heatmapResolutions);
      if (resolutionKeys.length === 0) {
        throw new Error("No heatmap resolutions available");
      }
      const selectedResolution = resolutionKeys[0];
      const heatmapTimeline = heatmapResolutions[selectedResolution];
      console.log(`📐 Using resolution: ${selectedResolution}`);
      console.log(`📅 Available time periods: ${Object.keys(heatmapTimeline).length}`);
      const firstTimeSlice = Object.values(heatmapTimeline)[0];
      const missingTypes = recordTypes.filter((type) => !firstTimeSlice || !firstTimeSlice[type]);
      if (missingTypes.length > 0) {
        throw new Error(`RecordTypes "${missingTypes.join(", ")}" not found in heatmap data`);
      }
      let resultTimeline;
      if (!tags || tags.length === 0) {
        resultTimeline = this.mergeHeatmapTimelines(heatmapTimeline, recordTypes);
        console.log(`🔥 Returning merged base heatmap timeline for recordTypes "${recordTypes.join(", ")}": ${Object.keys(resultTimeline).length} periods`);
      } else if (tags.length === 1) {
        const tag = tags[0];
        resultTimeline = this.mergeHeatmapTimelines(heatmapTimeline, recordTypes, tag);
        if (Object.keys(resultTimeline).length === 0) {
          throw new Error(`Tag "${tag}" not found for recordTypes "${recordTypes.join(", ")}" in any time period`);
        }
        console.log(`🏷️ Returning tag-filtered merged timeline for "${tag}": ${Object.keys(resultTimeline).length} periods`);
      } else {
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
        resolution: "",
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
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
const PRIVATE_VISUALIZATION_BINARY_PATH = "../preprocessor/visualization.bin";
const apiService = new VisualizationApiService(PRIVATE_VISUALIZATION_BINARY_PATH);
let initPromise = null;
async function getApiService() {
  if (!initPromise) {
    initPromise = apiService.initialize();
  }
  await initPromise;
  return apiService;
}
export {
  getApiService as g
};

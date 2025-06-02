import { decode } from "@msgpack/msgpack";
import { fixDecodedHeatmapsTypedArrays } from "./utils";
import type {
  GeoFeatures,
  BinaryMetadata,
  HeatmapResponse,
  HeatmapsResponse,
  MetadataResponse,
  CellFeaturesResponse,
  ContentClass,
  Heatmap,
  HistogramBin,
  Histogram,
  HistogramResponse,
} from "@atm/shared-types";

export type ApiHandler = (req: Request) => Promise<Response>;

function jsonResponse(data: unknown, status = 200) {
  // Convert TypedArrays to regular arrays for proper JSON serialization
  const serializedData = JSON.stringify(data, (key, value) => {
    // Check if value is a TypedArray (like Float32Array)
    if (
      value &&
      value.constructor &&
      value.constructor.name.includes("Array") &&
      value.constructor !== Array
    ) {
      return Array.from(value);
    }
    return value;
  });

  return new Response(serializedData, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

function errorResponse(message: string, status = 400) {
  return jsonResponse({ error: message }, status);
}

export class GridApi {
  private binaryBuffer: ArrayBufferLike | null = null;
  private metadata: BinaryMetadata | null = null;
  private dataStartOffset: number = 0;

  constructor(private binaryPath: string) {}

async initialize() {
    try {
        if (!this.binaryBuffer) {
            console.log("Opening binary file...");
            const mmap = Bun.mmap(this.binaryPath);
            const buffer = mmap.buffer as ArrayBufferLike;
            this.binaryBuffer = buffer;
            
            console.log("Buffer size:", buffer.byteLength);
            
            if (buffer.byteLength < 4) {
                throw new Error("Binary file too small - missing metadata size");
            }

            const dataView = new DataView(buffer);
            const metadataSize = dataView.getUint32(0, false);
            console.log("Metadata size from binary:", metadataSize);
            
            if (buffer.byteLength < 4 + metadataSize) {
                throw new Error(`Binary file truncated. Expected ${4 + metadataSize} bytes, got ${buffer.byteLength}`);
            }

            try {
                const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
                const metadata = decode(metadataBytes) as BinaryMetadata;
                
                // Debug the loaded metadata
                console.log("Metadata keys:", Object.keys(metadata));
                console.log("Histogram exists in metadata:", !!metadata.histogram);
                if (metadata.histogram) {
                    console.log("Histogram bins length:", metadata.histogram.bins?.length);
                    console.log("Histogram maxCount:", metadata.histogram.maxCount);
                    console.log("Histogram contentMaxCounts keys:", Object.keys(metadata.histogram.contentMaxCounts || {}));
                } else {
                    console.log("WARNING: Histogram is missing from metadata!");
                }
                
                this.metadata = metadata;
                this.dataStartOffset = 4 + metadataSize;
                
                console.log("Successfully decoded metadata");
                console.log("Data start offset:", this.dataStartOffset);
                console.log("Number of periods:", Object.keys(this.metadata.timeSliceIndex).length);
            } catch (error) {
                console.error("Failed to decode metadata:", error);
                throw error;
            }
        }
    } catch (error) {
        console.error("Failed to initialize binary data:", error);
        throw error;
    }
}

  getMetadata: ApiHandler = async () => {
    if (!this.metadata) {
      return errorResponse("Metadata not initialized", 500);
    }
    return jsonResponse({
      dimensions: this.metadata.dimensions,
      timeRange: this.metadata.timeRange,
      timePeriods: this.metadata.timePeriods,
      heatmapBlueprint: this.metadata.heatmapBlueprint,
      featuresStatistics: this.metadata.featuresStatistics,
    } as MetadataResponse);
  };

  getHeatmap: ApiHandler = async (req) => {
    if (!this.metadata) {
      return errorResponse("Metadata not initialized", 500);
    }

    const url = new URL(req.url);
    const period = url.searchParams.get("period");
    const contentClasses =
      (url.searchParams.get("contentClasses")?.split(",") as ContentClass[]) ||
      [];
    const tags = url.searchParams.get("tags")?.split(",") || [];

    const periods = Object.keys(this.metadata.heatmaps);

    // No heatmaps available
    if (periods.length === 0) {
      return errorResponse("No heatmaps available", 404);
    }

    // If period not specified or invalid, return first period's heatmap
    const targetPeriod =
      !period || !this.metadata.heatmaps[period] ? periods[0] : period;

    try {
      let heatmap: Heatmap;

      // If no content classes specified, return first content class's heatmap
      if (contentClasses.length === 0) {
        const firstContentClass = Object.keys(
          this.metadata.heatmaps[targetPeriod].contentClasses,
        )[0] as ContentClass;
        heatmap =
          this.metadata.heatmaps[targetPeriod].contentClasses[firstContentClass]
            .base;
      } else {
        // If multiple content classes or tags specified, combine heatmaps
        heatmap = this.combineHeatmaps(targetPeriod, contentClasses, tags);
      }

      return jsonResponse({
        heatmap: heatmap,
        timeRange: this.metadata.timeRange,
        availablePeriods: periods,
      } as HeatmapResponse);
    } catch (error) {
      console.error("Error generating heatmap:", error);
      return errorResponse(
        `Error generating heatmap: ${error instanceof Error ? error.message : "Unknown error"}`,
        500,
      );
    }
  };

  getHeatmaps: ApiHandler = async (req) => {
    if (!this.metadata) {
      return errorResponse("Metadata not initialized", 500);
    }

    const url = new URL(req.url);
    const contentClasses =
      (url.searchParams.get("contentClasses")?.split(",") as ContentClass[]) ||
      [];
    const tags = url.searchParams.get("tags")?.split(",") || [];

    try {
      const periodHeatmaps: Record<string, Heatmap> = {};
      const periods = Object.keys(this.metadata.heatmaps);
      const isPrecomputed =
        contentClasses.length <= 1 && (!tags.length || tags.length === 1);

      for (const period of periods) {
        const periodData = this.metadata.heatmaps[period];

        if (isPrecomputed) {
          let selectedContentClass: ContentClass;

          if (contentClasses.length === 0) {
            selectedContentClass = Object.keys(
              periodData.contentClasses,
            )[0] as ContentClass;
          } else {
            selectedContentClass = periodData.contentClasses[contentClasses[0]]
              ? contentClasses[0]
              : (Object.keys(periodData.contentClasses)[0] as ContentClass);
          }

          const contentClassData =
            periodData.contentClasses[selectedContentClass];

          if (tags.length === 1) {
            const tag = tags[0];
            if (contentClassData.tags[tag]) {
              periodHeatmaps[period] = contentClassData.tags[tag];
            }
          } else {
            periodHeatmaps[period] = contentClassData.base;
          }
        } else {
          const heatmapsToMerge: Heatmap[] = [];

          for (const contentClass of contentClasses) {
            const contentClassData = periodData.contentClasses[contentClass];
            if (!contentClassData) continue;

            if (tags.length > 0) {
              for (const tag of tags) {
                if (contentClassData.tags[tag]) {
                  heatmapsToMerge.push(contentClassData.tags[tag]);
                }
              }
            } else {
              heatmapsToMerge.push(contentClassData.base);
            }
          }

          if (heatmapsToMerge.length > 0) {
            periodHeatmaps[period] = this.mergeHeatmapsAND(heatmapsToMerge);
          }
        }
      }

      return jsonResponse({
        heatmaps: periodHeatmaps,
        timeRange: this.metadata.timeRange,
        availablePeriods: periods,
        isComputed: !isPrecomputed,
      } as HeatmapsResponse);
    } catch (error) {
      console.error("Error generating heatmaps:", error);
      return errorResponse("Internal server error", 500);
    }
  };

  getHistogram: ApiHandler = async (req) => {
    if (!this.metadata) {
      return errorResponse("Metadata not initialized", 500);
    }

    const url = new URL(req.url);
    const contentClasses =
      (url.searchParams.get("contentClasses")?.split(",") as ContentClass[]) ||
      [];
    const tags = url.searchParams.get("tags")?.split(",") || [];

    try {
      // If no filters specified, return the complete precomputed histogram
      if (contentClasses.length === 0 && tags.length === 0) {
        return jsonResponse({
          histogram: this.metadata.histogram,
          timeRange: this.metadata.timeRange,
          availablePeriods: this.metadata.timePeriods,
        } as HistogramResponse);
      }

      const filteredHistogram = this.filterHistogram(this.metadata.histogram, contentClasses, tags);

      return jsonResponse({
        histogram: filteredHistogram,
        timeRange: this.metadata.timeRange,
        availablePeriods: this.metadata.timePeriods,
      } as HistogramResponse);
    } catch (error) {
      console.error("Error serving histogram:", error);
      return errorResponse(
        `Error serving histogram: ${error instanceof Error ? error.message : "Unknown error"}`,
        500,
      );
    }
  };

  private filterHistogram(
    originalHistogram: Histogram,
    contentClasses: ContentClass[],
    tags: string[],
  ): Histogram {
    const filteredBins: HistogramBin[] = [];
    let maxCount = 0;
    const contentMaxCounts: Record<ContentClass, number> = {};

    // Get all available content classes if none specified
    const classesToInclude =
      contentClasses.length > 0
        ? contentClasses
        : (Object.keys(originalHistogram.contentMaxCounts) as ContentClass[]);

    // Initialize content max counts
    for (const cls of classesToInclude) {
      contentMaxCounts[cls] = 0;
    }

    // Filter each bin
    for (const originalBin of originalHistogram.bins) {
      const filteredBin: HistogramBin = {
        period: originalBin.period,
        count: 0,
        contentCounts: Object.fromEntries(
          classesToInclude.map((cls) => [cls, 0]),
        ) as Record<ContentClass, number>,
        tagCounts: Object.fromEntries(
          classesToInclude.map((cls) => [cls, {}]),
        ) as Record<ContentClass, Record<string, number>>,
      };

      // Process each content class
      for (const contentClass of classesToInclude) {
        if (tags.length === 0) {
          // No tag filter - use content class counts
          filteredBin.contentCounts[contentClass] =
            originalBin.contentCounts[contentClass] || 0;
          filteredBin.count += filteredBin.contentCounts[contentClass];
        } else {
          // Tag filter - sum up specified tags
          for (const tag of tags) {
            const tagCount = originalBin.tagCounts[contentClass]?.[tag] || 0;
            filteredBin.tagCounts[contentClass][tag] = tagCount;
            filteredBin.contentCounts[contentClass] += tagCount;
            filteredBin.count += tagCount;
          }
        }

        // Update max count for this content class
        contentMaxCounts[contentClass] = Math.max(
          contentMaxCounts[contentClass],
          filteredBin.contentCounts[contentClass],
        );
      }

      // Update overall max count
      maxCount = Math.max(maxCount, filteredBin.count);

      filteredBins.push(filteredBin);
    }

    return {
      bins: filteredBins,
      maxCount,
      contentMaxCounts,
    };
  }

  getCellFeatures: ApiHandler = async (req) => {
    if (!this.metadata) {
      return errorResponse("Metadata not initialized", 500);
    }

    const url = new URL(req.url);
    const cellId = url.pathname.slice("/grid/cell/".length);
    const period = url.searchParams.get("period");
    const page = parseInt(url.searchParams.get("page") ?? "1");
    const contentClasses =
      (url.searchParams.get("contentClasses")?.split(",") as ContentClass[]) ||
      [];
    const tags = url.searchParams.get("tags")?.split(",") || [];

    if (!period) {
      return errorResponse("Period parameter is required", 400);
    }

    try {
      // Check if the requested time period exists
      if (!this.metadata?.timeSliceIndex[period]) {
        return errorResponse(`Time period '${period}' not found`, 404);
      }

      const timeSlice = this.metadata.timeSliceIndex[period];
      const cell = timeSlice.cells[cellId];

      // If the cell doesn't exist in this period, return empty data
      if (!cell) {
        return jsonResponse({
          cellId,
          period,
          features: [],
          featureCount: 0,
          currentPage: 1,
          totalPages: 0,
        });
      }

      let features: GeoFeatures[] = [];
      let totalPages = 0;
      let totalFeatures = 0;

      // If no specific content classes are requested, use all available content classes
      const classesToFetch =
        contentClasses.length > 0
          ? contentClasses
          : (Object.keys(cell.contentOffsets) as ContentClass[]);

      // Case 1: Filter by content classes and tags
      if (tags.length > 0) {
        // For each requested content class and tag combination
        for (const contentClass of classesToFetch) {
          // Skip if this content class doesn't exist for this cell
          if (
            !cell.contentOffsets[contentClass] ||
            cell.contentOffsets[contentClass].length === 0
          ) {
            continue;
          }

          // Get features for each requested tag
          for (const tag of tags) {
            // Skip if this content class doesn't have this tag
            if (
              !cell.contentTagOffsets[contentClass]?.[tag] ||
              cell.contentTagOffsets[contentClass][tag].length === 0
            ) {
              continue;
            }

            // Fetch the tag features
            const tagOffset = cell.contentTagOffsets[contentClass][tag];
            const taggedFeaturesBytes = new Uint8Array(
              this.binaryBuffer!,
              this.dataStartOffset + tagOffset.offset,
              tagOffset.length,
            );

            const taggedFeatures = decode(taggedFeaturesBytes) as GeoFeatures[];
            features.push(...taggedFeatures);
            totalFeatures += taggedFeatures.length;
          }
        }

        // Tag filtering doesn't support pagination
        totalPages = 1;
      }
      // Case 2: Single content class - use content-class specific pagination
      else if (contentClasses.length === 1) {
        const contentClass = contentClasses[0];
        const pageKey = `page${page}`;

        // Check if content-class specific pagination exists and has this page
        if (
          cell.contentPages &&
          cell.contentPages[contentClass] &&
          Object.keys(cell.contentPages[contentClass]).includes(pageKey)
        ) {
          // Get total pages for this content class
          totalPages = Object.keys(cell.contentPages[contentClass]).length;

          // Fetch the content-class specific page
          const contentOffset = cell.contentPages[contentClass][pageKey];

          if (contentOffset && contentOffset.length > 0) {
            const contentFeaturesBytes = new Uint8Array(
              this.binaryBuffer!,
              this.dataStartOffset + contentOffset.offset,
              contentOffset.length,
            );

            const contentFeatures = decode(
              contentFeaturesBytes,
            ) as GeoFeatures[];
            features.push(...contentFeatures);
            totalFeatures += contentFeatures.length;
          }
        }
        // Fallback to original pagination if content-class pagination not available
        else if (cell.pages && Object.keys(cell.pages).includes(pageKey)) {
          // Check if the requested page exists
          if (
            !cell.pages[pageKey][contentClass] ||
            cell.pages[pageKey][contentClass].length === 0
          ) {
            // If no content for this class on this page, return empty
            return jsonResponse({
              cellId,
              period,
              features: [],
              featureCount: 0,
              currentPage: page,
              totalPages: Object.keys(cell.pages).length,
              contentClasses: classesToFetch,
              tags: tags,
            } as CellFeaturesResponse);
          }

          // Get total pages from combined pagination
          totalPages = Object.keys(cell.pages).length;

          // Fetch content from original pagination
          const contentOffset = cell.pages[pageKey][contentClass];
          const contentFeaturesBytes = new Uint8Array(
            this.binaryBuffer!,
            this.dataStartOffset + contentOffset.offset,
            contentOffset.length,
          );

          const contentFeatures = decode(contentFeaturesBytes) as GeoFeatures[];
          features.push(...contentFeatures);
          totalFeatures += contentFeatures.length;
        } else {
          return errorResponse(
            `Page ${page} not found for content class ${contentClass} in cell ${cellId}`,
            404,
          );
        }

        // Calculate total features for this content class
        if (cell.contentOffsets[contentClass]) {
          totalFeatures = cell.contentOffsets[contentClass].length > 0 ? 1 : 0;
        }
      } else {
        const pageKey = `page${page}`;

        // Check if the requested page exists in standard pagination
        if (!Object.keys(cell.pages).includes(pageKey) && page > 1) {
          return errorResponse(
            `Page ${page} not found for cell ${cellId}`,
            404,
          );
        }

        // Get total pages
        totalPages = Object.keys(cell.pages).length;

        // First, collect features by content class
        const featuresByClass: Record<string, GeoFeatures[]> = {};

        // For each content class, try to get data from its content-specific pagination first
        for (const contentClass of classesToFetch) {
          // Try to get data from content-specific pagination (always use page 1 for each class)
          if (
            cell.contentPages &&
            cell.contentPages[contentClass] &&
            cell.contentPages[contentClass]["page1"] &&
            cell.contentPages[contentClass]["page1"].length > 0
          ) {
            const contentOffset = cell.contentPages[contentClass]["page1"];
            const contentFeaturesBytes = new Uint8Array(
              this.binaryBuffer!,
              this.dataStartOffset + contentOffset.offset,
              contentOffset.length,
            );

            const contentFeatures = decode(
              contentFeaturesBytes,
            ) as GeoFeatures[];
            featuresByClass[contentClass] = contentFeatures;
          }
          // Fallback to original pagination if needed
          else if (
            cell.pages[pageKey] &&
            cell.pages[pageKey][contentClass] &&
            cell.pages[pageKey][contentClass].length > 0
          ) {
            const contentOffset = cell.pages[pageKey][contentClass];
            const contentFeaturesBytes = new Uint8Array(
              this.binaryBuffer!,
              this.dataStartOffset + contentOffset.offset,
              contentOffset.length,
            );

            const contentFeatures = decode(
              contentFeaturesBytes,
            ) as GeoFeatures[];
            featuresByClass[contentClass] = contentFeatures;
          } else {
            featuresByClass[contentClass] = [];
          }
        }

        // Now interleave/shuffle the features
        const allClasses = Object.keys(featuresByClass);
        const maxLength = Math.max(
          ...allClasses.map((cls) => featuresByClass[cls].length || 0),
          0,
        );

        // Take one from each class in turn until we've used them all
        for (let i = 0; i < maxLength; i++) {
          // Shuffle the order of classes for each round
          const shuffledClasses = [...allClasses].sort(
            () => Math.random() - 0.5,
          );

          for (const cls of shuffledClasses) {
            if (featuresByClass[cls] && i < featuresByClass[cls].length) {
              features.push(featuresByClass[cls][i]);
            }
          }
        }

        // Update total features and pages accordingly
        totalFeatures = features.length;
        if (totalPages === 0) totalPages = 1;
      }

      // Remove duplicates if needed
      const uniqueFeatures = this.removeDuplicateFeatures(features);

      return jsonResponse({
        cellId,
        period,
        features: uniqueFeatures,
        featureCount: uniqueFeatures.length,
        currentPage: page,
        totalPages,
        totalFeatures,
        contentClasses: classesToFetch,
        tags: tags,
      } as CellFeaturesResponse);
    } catch (error) {
      console.error("Error serving cell data:", error);
      return errorResponse(
        `Internal server error: ${error instanceof Error ? error.message : "Unknown error"}`,
        500,
      );
    }
  };

  // private combineHeatmaps(
  //     period: string,
  //     contentClasses: ContentClass[],
  //     tags: string[]
  // ): Heatmap {
  //     if (!this.metadata) {
  //         throw new Error("Metadata not initialized");
  //     }

  //     const periodHeatmap = this.metadata.heatmaps[period];
  //     if (!periodHeatmap) {
  //         // Return empty heatmap for non-existent period
  //         return this.createEmptyHeatmap();
  //     }

  //     // If no content classes specified, return empty heatmap
  //     if (contentClasses.length === 0) {
  //         return this.createEmptyHeatmap();
  //     }

  //     // Get all relevant heatmaps (filter out invalid content classes)
  //     const heatmapsToMerge: Heatmap[] = [];

  //     for (const contentClass of contentClasses) {
  //         // Skip invalid content classes instead of throwing an error
  //         if (!periodHeatmap.contentClasses[contentClass]) {
  //             console.warn(`Content class "${contentClass}" not found in period ${period}`);
  //             continue;
  //         }

  //         if (tags.length === 0) {
  //             // If no tags, use base heatmap for this content class
  //             heatmapsToMerge.push(periodHeatmap.contentClasses[contentClass].base);
  //         } else {
  //             // If tags specified, use tag heatmaps (only those that exist)
  //             for (const tag of tags) {
  //                 if (periodHeatmap.contentClasses[contentClass].tags[tag]) {
  //                     heatmapsToMerge.push(periodHeatmap.contentClasses[contentClass].tags[tag]);
  //                 }
  //             }
  //         }
  //     }

  //     // If no heatmaps to merge, return empty heatmap
  //     if (heatmapsToMerge.length === 0) {
  //         return this.createEmptyHeatmap();
  //     }

  //     // Merge heatmaps
  //     return this.mergeHeatmapsAND(heatmapsToMerge);
  // }
  private mergeHeatmapsOR(heatmaps: Heatmap[]): Heatmap {
    if (heatmaps.length === 0) {
      return this.createEmptyHeatmap();
    }

    if (heatmaps.length === 1) {
      return heatmaps[0];
    }

    const firstHeatmap = heatmaps[0];
    const length = firstHeatmap.countArray.length;

    const resultCount = new Uint32Array(length);

    // Sum count arrays
    for (const heatmap of heatmaps) {
      for (let i = 0; i < length; i++) {
        resultCount[i] += heatmap.countArray[i];
      }
    }

    // Calculate density using log normalization
    const maxCount = resultCount.reduce((max, current) => {
      return current > max ? current : max;
    }, resultCount[0] || 0);

    const resultDensity = new Float32Array(length);

    if (maxCount > 0) {
      const maxTransformed = Math.log(maxCount + 1);
      for (let i = 0; i < length; i++) {
        resultDensity[i] =
          resultCount[i] > 0
            ? Math.log(resultCount[i] + 1) / maxTransformed
            : 0;
      }
    }

    return {
      countArray: resultCount,
      densityArray: resultDensity,
    };
  }

  private mergeHeatmapsAND(heatmaps: Heatmap[]): Heatmap {
    if (heatmaps.length === 0) {
      return this.createEmptyHeatmap();
    }

    if (heatmaps.length === 1) {
      return heatmaps[0];
    }

    const firstHeatmap = heatmaps[0];
    const length = firstHeatmap.countArray.length;

    const resultCount = new Uint32Array(length);

    // First determine which cells have data in ALL heatmaps (AND operation)
    for (let i = 0; i < length; i++) {
      let hasDataInAll = true;
      let minValue = Infinity;

      // Check if all heatmaps have data in this cell
      for (const heatmap of heatmaps) {
        if (heatmap.countArray[i] <= 0) {
          hasDataInAll = false;
          break;
        }

        // Keep track of the minimum value for each cell
        if (heatmap.countArray[i] < minValue) {
          minValue = heatmap.countArray[i];
        }
      }

      // Only cells with data in ALL heatmaps get a value
      resultCount[i] = hasDataInAll ? minValue : 0;
    }

    // Calculate density using log normalization
    const maxCount = resultCount.reduce((max, current) => {
      return current > max ? current : max;
    }, resultCount[0] || 0);
    const resultDensity = new Float32Array(length);

    if (maxCount > 0) {
      const maxTransformed = Math.log(maxCount + 1);
      for (let i = 0; i < length; i++) {
        resultDensity[i] =
          resultCount[i] > 0
            ? Math.log(resultCount[i] + 1) / maxTransformed
            : 0;
      }
    }

    return {
      countArray: resultCount,
      densityArray: resultDensity,
    };
  }

  private createEmptyHeatmap(): Heatmap {
    // Create empty heatmap with size based on blueprint
    const rows = this.metadata?.heatmapBlueprint.rows || 0;
    const cols = this.metadata?.heatmapBlueprint.cols || 0;
    const length = rows * cols;

    return {
      countArray: new Uint32Array(length),
      densityArray: new Float32Array(length),
    };
  }

  private removeDuplicateFeatures(features: GeoFeatures[]): GeoFeatures[] {
    // This assumes each feature has a unique combination of properties that can be used to identify it
    const seen = new Set<string>();
    const uniqueFeatures: GeoFeatures[] = [];

    for (const feature of features) {
      // Create a unique identifier for this feature
      // Here we use content_class + title + start_date as a simple identifier
      const id = `${feature.content_class}_${feature.properties.title}_${feature.properties.start_date}`;

      if (!seen.has(id)) {
        seen.add(id);
        uniqueFeatures.push(feature);
      }
    }

    return uniqueFeatures;
  }
}

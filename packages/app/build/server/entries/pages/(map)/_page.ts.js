import { a as createError, b as createValidationError, c as createPageErrorData } from "../../../chunks/error.js";
import "clsx";
function createLoadingState() {
  let isLoading = false;
  let loadingCount = 0;
  return {
    get isLoading() {
      return isLoading;
    },
    startLoading: () => {
      console.log("starting loading!");
      loadingCount++;
      isLoading = true;
    },
    stopLoading: () => {
      loadingCount = Math.max(0, loadingCount - 1);
      isLoading = loadingCount > 0;
    },
    reset: () => {
      loadingCount = 0;
      isLoading = false;
    }
  };
}
const loadingState = createLoadingState();
const load = async ({ fetch, url }) => {
  loadingState.startLoading();
  const errors = [];
  let metadata = null;
  let histogram = null;
  let heatmapTimeline = null;
  const recordTypesParam = url.searchParams.get("recordTypes");
  const tagsParam = url.searchParams.get("tags");
  try {
    console.log("🔄 Loading metadata from API...");
    const response = await fetch("/api/metadata");
    if (!response.ok) {
      errors.push(createError(
        "error",
        "API Request Failed",
        `Failed to fetch metadata: HTTP ${response.status}`,
        { status: response.status, statusText: response.statusText }
      ));
    } else {
      const apiResponse = await response.json();
      if (!apiResponse.success) {
        errors.push(createError(
          "error",
          "API Error",
          apiResponse.message || "API returned unsuccessful response",
          { response: apiResponse }
        ));
      } else {
        metadata = apiResponse;
        console.log("✅ Metadata loaded successfully:", {
          version: metadata.version,
          timestamp: metadata.timestamp,
          timeSlices: metadata.timeSlices.length,
          recordTypes: metadata.recordTypes,
          tags: metadata.tags.length,
          resolutions: metadata.resolutions.length,
          primaryGridDimensions: `${metadata.heatmapDimensions.colsAmount}x${metadata.heatmapDimensions.rowsAmount}`,
          allResolutionDimensions: Object.keys(metadata.resolutionDimensions || {}),
          timeRange: metadata.timeRange,
          totalFeatures: metadata.stats?.totalFeatures
        });
        console.log("🗺️ Processing bounds:", {
          primaryResolution: {
            minLon: metadata.heatmapDimensions.minLon,
            maxLon: metadata.heatmapDimensions.maxLon,
            minLat: metadata.heatmapDimensions.minLat,
            maxLat: metadata.heatmapDimensions.maxLat,
            cellWidth: metadata.heatmapDimensions.cellWidth,
            cellHeight: metadata.heatmapDimensions.cellHeight
          }
        });
        if (metadata.resolutionDimensions) {
          console.log("📐 Available resolutions:", metadata.resolutionDimensions);
        }
      }
    }
  } catch (err) {
    console.error("❌ Failed to load metadata:", err);
    errors.push(createError(
      "error",
      "Metadata Load Failed",
      "Could not load visualization metadata. Please ensure the server is running and the binary file is available.",
      {
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }
    ));
  }
  let currentRecordTypes = ["text"];
  if (metadata?.recordTypes) {
    if (recordTypesParam) {
      const requestedTypes = recordTypesParam.split(",").map((t) => t.trim());
      const validTypes = requestedTypes.filter((type) => metadata.recordTypes.includes(type));
      if (validTypes.length > 0) {
        currentRecordTypes = validTypes;
      } else {
        currentRecordTypes = [metadata.recordTypes[0] || "text"];
        errors.push(createValidationError(
          "recordTypes",
          recordTypesParam,
          `Must contain at least one of: ${metadata.recordTypes.join(", ")}`
        ));
      }
    } else {
      currentRecordTypes = metadata.recordTypes;
    }
  }
  let tags;
  if (tagsParam) {
    tags = tagsParam.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0);
  }
  const histogramPromise = (async () => {
    try {
      console.log(`📊 Loading histogram for recordTypes: ${currentRecordTypes.join(", ")}, tags: ${tags?.join(", ") || "none"}`);
      const histogramUrl = `/api/histogram?recordTypes=${currentRecordTypes.join(",")}${tags ? `&tags=${tags.join(",")}` : ""}`;
      const histogramResponse = await fetch(histogramUrl);
      if (!histogramResponse.ok) {
        errors.push(createError(
          "warning",
          "Histogram Load Failed",
          `Failed to load histogram data: HTTP ${histogramResponse.status}`,
          { recordTypes: currentRecordTypes, tags, status: histogramResponse.status }
        ));
      } else {
        const histogramData = await histogramResponse.json();
        if (!histogramData.success) {
          errors.push(createError(
            "warning",
            "Histogram API Error",
            histogramData.message || "Failed to get histogram data",
            { recordTypes: currentRecordTypes, tags, response: histogramData }
          ));
        } else {
          histogram = histogramData;
          console.log("✅ Histogram loaded successfully:", {
            recordTypes: currentRecordTypes,
            tags,
            totalFeatures: histogram.histogram.totalFeatures,
            timePeriods: histogram.histogram.bins.length,
            maxCount: histogram.histogram.maxCount,
            timeRange: histogram.histogram.timeRange
          });
        }
      }
    } catch (err) {
      console.error("❌ Failed to load histogram:", err);
      errors.push(createError(
        "warning",
        "Histogram Load Error",
        "Could not load histogram data. The map will still function but temporal data may be limited.",
        {
          recordTypes: currentRecordTypes,
          tags,
          error: err instanceof Error ? err.message : "Unknown error"
        }
      ));
    }
  })();
  const heatmapPromise = (async () => {
    try {
      console.log(`🔥 Loading heatmap timeline for recordTypes: ${currentRecordTypes.join(", ")}, tags: ${tags?.join(", ") || "none"}`);
      const heatmapUrl = `/api/heatmaps?recordTypes=${currentRecordTypes.join(",")}${tags ? `&tags=${tags.join(",")}` : ""}`;
      const heatmapResponse = await fetch(heatmapUrl);
      if (!heatmapResponse.ok) {
        errors.push(createError(
          "warning",
          "Heatmap Load Failed",
          `Failed to load heatmap timeline: HTTP ${heatmapResponse.status}`,
          { recordTypes: currentRecordTypes, tags, status: heatmapResponse.status }
        ));
      } else {
        const heatmapData = await heatmapResponse.json();
        if (!heatmapData.success) {
          errors.push(createError(
            "warning",
            "Heatmap API Error",
            heatmapData.message || "Failed to get heatmap timeline data",
            { recordTypes: currentRecordTypes, tags, response: heatmapData }
          ));
        } else {
          heatmapTimeline = heatmapData;
        }
      }
    } catch (err) {
      console.error("❌ Failed to load heatmap timeline:", err);
      errors.push(createError(
        "warning",
        "Heatmap Load Error",
        "Could not load heatmap timeline. Spatial visualization may be limited.",
        {
          recordTypes: currentRecordTypes,
          tags,
          error: err instanceof Error ? err.message : "Unknown error"
        }
      ));
    }
  })();
  await Promise.all([histogramPromise, heatmapPromise]);
  loadingState.stopLoading();
  console.log(heatmapTimeline);
  return {
    metadata,
    histogram,
    heatmapTimeline,
    currentRecordTypes,
    tags,
    errorData: createPageErrorData(errors)
  };
};
export {
  load
};

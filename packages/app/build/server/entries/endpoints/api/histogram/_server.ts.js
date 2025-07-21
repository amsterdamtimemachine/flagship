import { e as error, j as json } from "../../../../chunks/index.js";
import { g as getApiService } from "../../../../chunks/apiServiceSingleton.js";
const GET = async ({ url }) => {
  try {
    const recordTypesParam = url.searchParams.get("recordTypes");
    const tagsParam = url.searchParams.get("tags");
    if (!recordTypesParam) {
      return error(400, { message: "recordTypes parameter is required" });
    }
    const validRecordTypes = ["text", "image", "event"];
    const recordTypes2 = recordTypesParam.split(",").map((t) => t.trim());
    const invalidTypes = recordTypes2.filter((type) => !validRecordTypes.includes(type));
    if (invalidTypes.length > 0) {
      return error(400, { message: `Invalid recordTypes: ${invalidTypes.join(", ")}. Must be one of: ${validRecordTypes.join(", ")}` });
    }
    let tags2;
    if (tagsParam) {
      tags2 = tagsParam.split(",").map((tag) => tag.trim()).filter((tag) => tag.length > 0);
    }
    console.log(`📊 Histogram API request - recordTypes: ${recordTypes2.join(", ")}, tags: ${tags2?.join(", ") || "none"}`);
    const apiService = await getApiService();
    const response = await apiService.getHistogram(recordTypes2, tags2);
    const headers = {
      "Cache-Control": "public, max-age=3600",
      // Cache for 1 hour
      "Access-Control-Allow-Origin": "*"
    };
    if (response.success) {
      console.log(`✅ Histogram API success - ${response.histogram.totalFeatures} features, ${response.histogram.bins.length} periods`);
      return json(response, { headers });
    } else {
      console.error(`❌ Histogram API error: ${response.message}`);
      return json(response, { status: 500, headers });
    }
  } catch (err) {
    console.error("❌ Histogram API unexpected error:", err);
    return json({
      histogram: {
        bins: [],
        maxCount: 0,
        timeRange: { start: "", end: "" },
        totalFeatures: 0
      },
      recordTypes: recordTypes || [],
      tags,
      success: false,
      message: err instanceof Error ? err.message : "Internal server error"
    }, {
      status: 500,
      headers: {
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
};
const OPTIONS = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
};
export {
  GET,
  OPTIONS
};

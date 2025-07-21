import { j as json } from "../../../../chunks/index.js";
import { g as getApiService } from "../../../../chunks/apiServiceSingleton.js";
const GET = async () => {
  try {
    console.log("📋 Metadata API request");
    const apiService = await getApiService();
    const metadata = await apiService.getVisualizationMetadata();
    console.log(`✅ Metadata API success - ${metadata.timeSlices.length} time slices, ${metadata.recordTypes.length} record types`);
    return json({
      ...metadata,
      success: true
    }, {
      headers: {
        "Cache-Control": "public, max-age=86400",
        // Cache for 24 hours (metadata rarely changes)
        "Access-Control-Allow-Origin": "*"
      }
    });
  } catch (err) {
    console.error("❌ Metadata API error:", err);
    return json({
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

import { j as json } from "../../../../chunks/index.js";
const GET = async ({ url, fetch }) => {
  try {
    const params = new URLSearchParams();
    url.searchParams.forEach((value, key) => {
      params.set(key, value);
    });
    const externalApiUrl = `https://atmbackend.create.humanities.uva.nl/api/geodata?${params.toString()}`;
    console.log("🌍 Proxying geodata request to:", externalApiUrl);
    const response = await fetch(externalApiUrl);
    if (!response.ok) {
      console.error("External API error:", response.status, response.statusText);
      return json(
        { error: "Failed to fetch data from external API", status: response.status },
        { status: response.status }
      );
    }
    const data = await response.json();
    return json(data, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return json(
      { error: "Internal server error", message: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
};
const OPTIONS = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
};
export {
  GET,
  OPTIONS
};

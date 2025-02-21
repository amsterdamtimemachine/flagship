import { expect, test, describe } from "bun:test";
import type { 
  GeoFeatures, 
  BinaryMetadata, 
  Heatmap, 
  HeatmapResponse, 
  CellFeaturesResponse,
  MetadataResponse,
  ContentClass
} from '@atm/shared-types';
import { config } from '../config';

// Base endpoints
const baseUrl = config.baseUrl;
const metadataUrl = `${baseUrl}/grid/metadata`;
const heatmapUrl = `${baseUrl}/grid/heatmap`;
const cellUrl = `${baseUrl}/grid/cell`;

// Test helpers
async function testGridCell(
  cellId: string, 
  options: {
    period?: string;
    page?: number;
    contentClasses?: ContentClass[];
    tags?: string[];
  } = {}
): Promise<{
  status: number;
  data?: CellFeaturesResponse;
  error?: string;
}> {
  // Build URL with query parameters
  let url = `${cellUrl}/${cellId}`;
  const params = new URLSearchParams();
  
  if (options.period) params.append('period', options.period);
  if (options.page) params.append('page', options.page.toString());
  if (options.contentClasses?.length) params.append('contentClasses', options.contentClasses.join(','));
  if (options.tags?.length) params.append('tags', options.tags.join(','));
  
  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;

  const response = await fetch(url);
  const data = await response.json();
  
  return {
    status: response.status,
    ...(response.ok ? { data: data as CellFeaturesResponse } : { error: data.error })
  };
}

async function testMetadata(): Promise<{
  status: number;
  data?: MetadataResponse;
  error?: string;
}> {
  const response = await fetch(metadataUrl);
  const data = await response.json();
  
  return {
    status: response.status,
    ...(response.ok ? { data: data as MetadataResponse } : { error: data.error })
  };
}

async function testHeatmap(options: {
  period?: string;
  contentClasses?: ContentClass[];
  tags?: string[];
} = {}): Promise<{
  status: number;
  data?: HeatmapResponse;
  error?: string;
}> {
  // Build URL with query parameters
  let url = heatmapUrl;
  const params = new URLSearchParams();
  
  if (options.period) params.append('period', options.period);
  if (options.contentClasses?.length) params.append('contentClasses', options.contentClasses.join(','));
  if (options.tags?.length) params.append('tags', options.tags.join(','));
  
  const queryString = params.toString();
  if (queryString) url += `?${queryString}`;

  const response = await fetch(url);
  const data = await response.json();
  
  return {
    status: response.status,
    ...(response.ok ? { data: data as HeatmapResponse } : { error: data.error })
  };
}

// Tests
describe("Grid API", () => {
  // Metadata tests
  describe("Metadata Endpoint", () => {
    test("should return metadata with 200 status", async () => {
      const result = await testMetadata();
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.dimensions).toBeDefined();
      expect(result.data?.timeRange).toBeDefined();
      expect(result.data?.heatmaps).toBeDefined();
      expect(result.data?.heatmapBlueprint).toBeDefined();
      expect(result.data?.featuresStatistics).toBeDefined();
    });
    
    test("metadata should contain expected time periods", async () => {
      const result = await testMetadata();
      
      // Assuming our dataset has data from 1600 to 2010
      const periods = Object.keys(result.data?.heatmaps || {});
      expect(periods.length).toBeGreaterThan(0);
      
      // Check for some expected periods
      expect(periods).toContain("1600_1610");
      expect(periods).toContain("1900_1910");
    });
    
    test("metadata should contain valid blueprint", async () => {
      const result = await testMetadata();
      
      const blueprint = result.data?.heatmapBlueprint;
      expect(blueprint).toBeDefined();
      expect(blueprint?.rows).toBeGreaterThan(0);
      expect(blueprint?.cols).toBeGreaterThan(0);
      expect(blueprint?.cells.length).toBe(blueprint?.rows * blueprint?.cols);
      
      // Check first cell structure
      const firstCell = blueprint?.cells[0];
      expect(firstCell?.cellId).toBeDefined();
      expect(firstCell?.row).toBeDefined();
      expect(firstCell?.col).toBeDefined();
      expect(firstCell?.bounds).toBeDefined();
    });
  });
  
  // Heatmap tests
  describe("Heatmap Endpoint", () => {
    test("should return default heatmap with 200 status", async () => {
      const result = await testHeatmap();
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
      expect(result.data?.timeRange).toBeDefined();
      expect(result.data?.availablePeriods).toBeDefined();
    });
    
    test("should return heatmap for specific period", async () => {
      const period = "1600_1610";
      const result = await testHeatmap({ period });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
    });
    
    test("should return heatmap for specific content class", async () => {
      const contentClasses: ContentClass[] = ["Image"];
      const result = await testHeatmap({ contentClasses });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
      
      // TypedArrays will be serialized as arrays
      expect(Array.isArray(result.data?.heatmap.countArray)).toBe(true);
      expect(Array.isArray(result.data?.heatmap.densityArray)).toBe(true);
    });
    
    test("should return combined heatmap for multiple content classes", async () => {
      const contentClasses: ContentClass[] = ["Image", "Event"];
      const result = await testHeatmap({ contentClasses });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
    });
    
    test("should return heatmap for content class + tag", async () => {
      const contentClasses: ContentClass[] = ["Image"];
      const tags = ["museum/indoor"];
      const result = await testHeatmap({ contentClasses, tags });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
    });
    
    test("should return heatmap for multiple content classes + tags", async () => {
      const contentClasses: ContentClass[] = ["Image", "Event"];
      const tags = ["museum/indoor", "art_gallery"];
      const result = await testHeatmap({ contentClasses, tags });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
    });
    
    test("non-existent period should return default period", async () => {
      const period = "9999_9999"; // Non-existent period
      const result = await testHeatmap({ period });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
    });
  });
  
  // Cell features tests
  describe("Cell Features Endpoint", () => {
    test("should return error when period is missing", async () => {
      const result = await testGridCell("10_10");
      
      expect(result.status).toBe(400);
      expect(result.error).toBeDefined();
    });
    
    test("should return features for valid cell", async () => {
      // Use a cell ID we know exists from the heatmap tests
      const result = await testGridCell("9_0", { period: "1600_1610" });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.cellId).toBe("9_0");
      expect(result.data?.period).toBe("1600_1610");
      expect(Array.isArray(result.data?.features)).toBe(true);
    });
    
    test("should return empty features for non-existent cell", async () => {
      const result = await testGridCell("999_999", { period: "1600_1610" });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.features.length).toBe(0);
      expect(result.data?.featureCount).toBe(0);
    });
    
    test("should return features filtered by content class", async () => {
      const result = await testGridCell("9_0", { 
        period: "1600_1610", 
        contentClasses: ["Image"] 
      });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data?.features)).toBe(true);
      
      // All features should be of the requested content class
      if (result.data?.features.length) {
        const allMatchingClass = result.data?.features.every(f => f.content_class === "Image");
        expect(allMatchingClass).toBe(true);
      }
    });
    
    test("should return features filtered by content class + tag", async () => {
      const result = await testGridCell("9_0", { 
        period: "1600_1610", 
        contentClasses: ["Image"],
        tags: ["museum/indoor"]
      });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data?.features)).toBe(true);
      
      // All features should be of the requested content class and have the tag
      if (result.data?.features.length) {
        const allMatchingClassAndTag = result.data?.features.every(f => 
          f.content_class === "Image" && 
          f.properties.ai?.tags?.includes("museum/indoor")
        );
        expect(allMatchingClassAndTag).toBe(true);
      }
    });
    
    test("should return features filtered by multiple content classes", async () => {
      const result = await testGridCell("9_0", { 
        period: "1600_1610", 
        contentClasses: ["Image", "Event"] 
      });
      
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data?.features)).toBe(true);
      
      // All features should be of one of the requested content classes
      if (result.data?.features.length) {
        const allMatchingClasses = result.data?.features.every(f => 
          ["Image", "Event"].includes(f.content_class)
        );
        expect(allMatchingClasses).toBe(true);
      }
    });
    
    test("should paginate features properly", async () => {
      // First page
      const result1 = await testGridCell("9_0", { 
        period: "1600_1610", 
        page: 1
      });
      
      expect(result1.status).toBe(200);
      expect(result1.data).toBeDefined();
      expect(result1.data?.currentPage).toBe(1);
      
      // If there's more than one page, test the second page
      if (result1.data?.totalPages && result1.data?.totalPages > 1) {
        const result2 = await testGridCell("9_0", { 
          period: "1600_1610", 
          page: 2
        });
        
        expect(result2.status).toBe(200);
        expect(result2.data).toBeDefined();
        expect(result2.data?.currentPage).toBe(2);
        
        // Features from page 1 and page 2 should be different
        const page1Features = result1.data?.features.map(f => f.properties.title);
        const page2Features = result2.data?.features.map(f => f.properties.title);
        
        const noDuplicates = page1Features.every(title => !page2Features.includes(title));
        expect(noDuplicates).toBe(true);
      }
    });
    
    test("should return 404 for non-existent page", async () => {
      const result = await testGridCell("9_0", { 
        period: "1600_1610", 
        page: 999 // Assuming this page doesn't exist
      });
      
      expect(result.status).toBe(404);
      expect(result.error).toBeDefined();
    });
  });
  
  // Edge cases and error handling
  describe("Edge Cases and Error Handling", () => {
    test("should handle non-existent period gracefully", async () => {
      const result = await testGridCell("9_0", { period: "9999_9999" });
      
      expect(result.status).toBe(404);
      expect(result.error).toBeDefined();
    });
    
    test("should handle invalid content class", async () => {
      const result = await testHeatmap({ 
        contentClasses: ["InvalidClass" as ContentClass] 
      });
      
      // Should still return 200 but with an empty or default heatmap
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
    });
    
    test("should handle invalid tag", async () => {
      const result = await testHeatmap({ 
        contentClasses: ["Image"],
        tags: ["non_existent_tag"]  
      });
      
      // Should still return 200 but with an empty or default heatmap
      expect(result.status).toBe(200);
      expect(result.data).toBeDefined();
      expect(result.data?.heatmap).toBeDefined();
    });
  });
  
  // Performance tests
  describe("Performance", () => {
    test("should handle multiple requests efficiently", async () => {
      const startTime = performance.now();
      
      const promises = [
        testMetadata(),
        testHeatmap(),
        testHeatmap({ contentClasses: ["Image"] }),
        testHeatmap({ contentClasses: ["Event"] }),
        testGridCell("9_0", { period: "1600_1610" })
      ];
      
      const results = await Promise.all(promises);
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      // All requests should succeed
      results.forEach(result => {
        expect(result.status).toBe(200);
      });
      
      // This is an arbitrary threshold that might need adjustment
      console.log(`Multiple requests completed in ${totalTime}ms`);
      expect(totalTime).toBeLessThan(5000); // 5 seconds max for all requests
    });
    
    test("combined heatmaps should be reasonably fast", async () => {
      const startTime = performance.now();
      
      const result = await testHeatmap({ 
        contentClasses: ["Image", "Event"],
        tags: ["museum/indoor", "art_gallery"]
      });
      
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      expect(result.status).toBe(200);
      
      // Again, arbitrary threshold
      console.log(`Combined heatmap request completed in ${totalTime}ms`);
      expect(totalTime).toBeLessThan(1000); // 1 second max for complex query
    });
  });
});

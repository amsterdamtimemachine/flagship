// src/tests/heatmap-generation.test.ts - Pure heatmap generation tests (UPDATED: Period-first structure)

import { describe, test, expect } from "bun:test";
import {
  getCellIdForCoordinates,
  processFeatureIntoCounts,
  generateHeatmap,
  createHeatmapAccumulator,
  generateHeatmapStack
} from '../processing/heatmaps';
import type { GridDimensions, AnyProcessedFeature } from '../types/geo';

describe("Heatmap Generation Logic (Text Only, Period-First Structure)", () => {
  
  const testGridDimensions: GridDimensions = {
    colsAmount: 3,
    rowsAmount: 3,
    cellWidth: 0.1,
    cellHeight: 0.1,
    minLon: 4.8,
    maxLon: 5.1,
    minLat: 52.3,
    maxLat: 52.6
  };

  test("should calculate correct cell IDs for coordinates", () => {
    // Test center of each cell
    expect(getCellIdForCoordinates({lon: 4.85, lat: 52.35}, testGridDimensions)).toBe("0_0");
    expect(getCellIdForCoordinates({lon: 4.95, lat: 52.35}, testGridDimensions)).toBe("0_1");
    expect(getCellIdForCoordinates({lon: 5.05, lat: 52.35}, testGridDimensions)).toBe("0_2");
    
    expect(getCellIdForCoordinates({lon: 4.85, lat: 52.45}, testGridDimensions)).toBe("1_0");
    expect(getCellIdForCoordinates({lon: 4.95, lat: 52.45}, testGridDimensions)).toBe("1_1");
    expect(getCellIdForCoordinates({lon: 5.05, lat: 52.45}, testGridDimensions)).toBe("1_2");
    
    expect(getCellIdForCoordinates({lon: 4.85, lat: 52.55}, testGridDimensions)).toBe("2_0");
    expect(getCellIdForCoordinates({lon: 4.95, lat: 52.55}, testGridDimensions)).toBe("2_1");
    expect(getCellIdForCoordinates({lon: 5.05, lat: 52.55}, testGridDimensions)).toBe("2_2");
  });

  test("should handle coordinates outside grid bounds", () => {
    expect(getCellIdForCoordinates({lon: 4.7, lat: 52.35}, testGridDimensions)).toBe(null);  // Too far west
    expect(getCellIdForCoordinates({lon: 5.2, lat: 52.35}, testGridDimensions)).toBe(null);  // Too far east
    expect(getCellIdForCoordinates({lon: 4.85, lat: 52.2}, testGridDimensions)).toBe(null);  // Too far south
    expect(getCellIdForCoordinates({lon: 4.85, lat: 52.7}, testGridDimensions)).toBe(null);  // Too far north
  });

  test("should correctly count text features in cells (no tags)", () => {
    const accumulator = createHeatmapAccumulator(testGridDimensions);
    
    // Create test text features with empty tags (matching real API data)
    const feature1: AnyProcessedFeature = {
      title: "Historical Document 1",
      dataset: "amsterdam_archives",
      url: "http://archives.nl/doc1",
      recordtype: "text",
      tags: [], // Empty tags array to match real API data
      startYear: 1900,
      endYear: 1910,
      geometry: {
        type: "Point",
        coordinates: {lon: 4.85, lat: 52.35} // Should be in cell 0_0
      }
    };

    const feature2: AnyProcessedFeature = {
      title: "Historical Document 2", 
      dataset: "amsterdam_archives",
      url: "http://archives.nl/doc2",
      recordtype: "text",
      tags: [], // Empty tags array to match real API data
      startYear: 1905,
      endYear: 1915,
      geometry: {
        type: "Point",
        coordinates: {lon: 4.85, lat: 52.35} // Same cell as feature1
      }
    };

    const feature3: AnyProcessedFeature = {
      title: "Modern Article",
      dataset: "modern_collection", 
      url: "http://modern.nl/article1",
      recordtype: "text",
      tags: [], // Empty tags array to match real API data
      startYear: 2000,
      endYear: 2010,
      geometry: {
        type: "Point",
        coordinates: {lon: 4.95, lat: 52.45} // Should be in cell 1_1
      }
    };

    // Process features
    processFeatureIntoCounts(feature1, accumulator);
    processFeatureIntoCounts(feature2, accumulator);
    processFeatureIntoCounts(feature3, accumulator);

    // Check base counts for text recordtype only
    const textCounts = accumulator.cellCounts.base.get("text");
    expect(textCounts?.get("0_0")).toBe(2); // Two text features in cell 0_0
    expect(textCounts?.get("1_1")).toBe(1); // One text feature in cell 1_1
    expect(textCounts?.get("0_1")).toBeUndefined(); // No features in cell 0_1

    // Verify no tags were collected (since all features have empty tags)
    expect(accumulator.collectedTags.size).toBe(0);

    // Verify tag counts are empty
    expect(accumulator.cellCounts.tags.size).toBe(0);
  });

  test("should generate correct heatmap arrays from count data", () => {
    // Create test count data
    const counts = new Map<string, number>();
    counts.set("0_0", 5);  // 5 features in top-left
    counts.set("1_1", 10); // 10 features in center
    counts.set("2_2", 2);  // 2 features in bottom-right

    const heatmap = generateHeatmap(counts, testGridDimensions);

    // Check array length
    expect(heatmap.countArray).toHaveLength(9); // 3x3 grid
    expect(heatmap.densityArray).toHaveLength(9);

    // Check count values (row-major order)
    expect(heatmap.countArray[0]).toBe(5);  // Cell 0_0 -> index 0
    expect(heatmap.countArray[4]).toBe(10); // Cell 1_1 -> index 4 (1*3 + 1)
    expect(heatmap.countArray[8]).toBe(2);  // Cell 2_2 -> index 8 (2*3 + 2)
    
    // Other cells should be 0
    expect(heatmap.countArray[1]).toBe(0);
    expect(heatmap.countArray[2]).toBe(0);
    expect(heatmap.countArray[3]).toBe(0);

    // Check density calculation (log normalization)
    const maxCount = 10;
    const maxTransformed = Math.log(maxCount + 1);
    
    expect(heatmap.densityArray[0]).toBeCloseTo(Math.log(6) / maxTransformed, 5); // log(5+1) / log(10+1)
    expect(heatmap.densityArray[4]).toBeCloseTo(1.0, 5); // log(10+1) / log(10+1) = 1.0
    expect(heatmap.densityArray[8]).toBeCloseTo(Math.log(3) / maxTransformed, 5); // log(2+1) / log(10+1)
    
    // Empty cells should have 0 density
    expect(heatmap.densityArray[1]).toBe(0);
    expect(heatmap.densityArray[2]).toBe(0);
  });

  test("should generate correct period-first heatmap stack structure", () => {
    // Create test accumulator with some data
    const accumulator = createHeatmapAccumulator(testGridDimensions);
    
    // Add test feature to accumulator
    const feature: AnyProcessedFeature = {
      title: "Test Document",
      dataset: "test",
      url: "http://test.com",
      recordtype: "text",
      tags: [], // No tags for now
      startYear: 1900,
      endYear: 1910,
      geometry: {
        type: "Point",
        coordinates: {lon: 4.85, lat: 52.35} // Cell 0_0
      }
    };
    
    processFeatureIntoCounts(feature, accumulator);
    
    // Generate heatmap stack for test period
    const period = "1900_1950";
    const heatmapStack = generateHeatmapStack(accumulator, period);
    
    // ✅ Test period-first structure
    expect(heatmapStack).toHaveProperty(period);
    expect(heatmapStack[period]).toHaveProperty('text');
    expect(heatmapStack[period]).toHaveProperty('image');
    expect(heatmapStack[period]).toHaveProperty('event');
    
    // Test text recordtype structure
    expect(heatmapStack[period]['text']).toHaveProperty('base');
    expect(heatmapStack[period]['text']).toHaveProperty('tags');
    
    // Test base heatmap has correct data
    const textBaseHeatmap = heatmapStack[period]['text'].base;
    expect(textBaseHeatmap.countArray).toHaveLength(9); // 3x3 grid
    expect(textBaseHeatmap.densityArray).toHaveLength(9);
    
    // Should have 1 feature in cell 0_0
    expect(textBaseHeatmap.countArray[0]).toBe(1);
    
    // Other recordtypes should be empty (no data)
    expect(heatmapStack[period]['image'].base.countArray[0]).toBe(0);
    expect(heatmapStack[period]['event'].base.countArray[0]).toBe(0);
    
    // Tags should be empty (no tags in test data)
    expect(Object.keys(heatmapStack[period]['text'].tags)).toHaveLength(0);
  });

  test("should handle empty count map for text data", () => {
    const counts = new Map<string, number>();
    const heatmap = generateHeatmap(counts, testGridDimensions);

    expect(heatmap.countArray).toHaveLength(9);
    expect(heatmap.densityArray).toHaveLength(9);
    
    // All cells should be 0
    expect(Array.from(heatmap.countArray)).toEqual([0,0,0,0,0,0,0,0,0]);
    expect(Array.from(heatmap.densityArray)).toEqual([0,0,0,0,0,0,0,0,0]);
  });

  test("should handle grid boundary coordinates correctly", () => {
    // Test exact boundary coordinates
    expect(getCellIdForCoordinates({lon: 4.8, lat: 52.3}, testGridDimensions)).toBe("0_0");   // Min corner
    expect(getCellIdForCoordinates({lon: 5.1, lat: 52.6}, testGridDimensions)).toBe(null);    // Max corner (exclusive)
    expect(getCellIdForCoordinates({lon: 5.099, lat: 52.599}, testGridDimensions)).toBe("2_2"); // Just inside max
  });

  test("should demonstrate multi-period structure access patterns", () => {
    console.log("ℹ️ Testing period-first structure access patterns");
    
    const accumulator = createHeatmapAccumulator(testGridDimensions);
    
    // Add test features
    const feature1: AnyProcessedFeature = {
      title: "Early Document",
      dataset: "test",
      url: "http://test.com/early",
      recordtype: "text",
      tags: [],
      startYear: 1900,
      endYear: 1910,
      geometry: { type: "Point", coordinates: {lon: 4.85, lat: 52.35} }
    };
    
    processFeatureIntoCounts(feature1, accumulator);
    
    // Generate stacks for different periods
    const period1900 = generateHeatmapStack(accumulator, "1900_1950");
    const period2000 = generateHeatmapStack(accumulator, "2000_2050");
    
    // Show access patterns
    console.log("✅ Access patterns:");
    console.log("   - period1900['1900_1950']['text'].base");
    console.log("   - period1900['1900_1950']['text'].tags[tagName]");
    
    // Verify both periods exist independently
    expect(period1900).toHaveProperty('1900_1950');
    expect(period2000).toHaveProperty('2000_2050');
    
    // Verify structure
    expect(period1900['1900_1950']['text'].base.countArray[0]).toBe(1);
    expect(period2000['2000_2050']['text'].base.countArray[0]).toBe(1);
    
    console.log("✅ Period-first structure working correctly");
  });

  test("should handle multiple periods in single stack", () => {
    const accumulator1 = createHeatmapAccumulator(testGridDimensions);
    const accumulator2 = createHeatmapAccumulator(testGridDimensions);
    
    // Create features for different periods
    const earlyFeature: AnyProcessedFeature = {
      title: "Early Document",
      dataset: "test",
      url: "http://test.com/early",
      recordtype: "text",
      tags: [],
      startYear: 1900,
      endYear: 1910,
      geometry: { type: "Point", coordinates: {lon: 4.85, lat: 52.35} } // Cell 0_0
    };
    
    const modernFeature: AnyProcessedFeature = {
      title: "Modern Document",
      dataset: "test",
      url: "http://test.com/modern",
      recordtype: "text",
      tags: [],
      startYear: 2000,
      endYear: 2010,
      geometry: { type: "Point", coordinates: {lon: 4.95, lat: 52.45} } // Cell 1_1
    };
    
    // Process features into different accumulators
    processFeatureIntoCounts(earlyFeature, accumulator1);
    processFeatureIntoCounts(modernFeature, accumulator2);
    
    // Generate separate period stacks
    const earlyStack = generateHeatmapStack(accumulator1, "1900_1950");
    const modernStack = generateHeatmapStack(accumulator2, "2000_2050");
    
    // Verify each period has correct data
    expect(earlyStack['1900_1950']['text'].base.countArray[0]).toBe(1); // Cell 0_0
    expect(earlyStack['1900_1950']['text'].base.countArray[4]).toBe(0); // Cell 1_1 empty
    
    expect(modernStack['2000_2050']['text'].base.countArray[0]).toBe(0); // Cell 0_0 empty
    expect(modernStack['2000_2050']['text'].base.countArray[4]).toBe(1); // Cell 1_1
    
    // Manually combine for testing multi-period structure
    const combinedStack = {
      ...earlyStack,
      ...modernStack
    };
    
    expect(Object.keys(combinedStack)).toEqual(['1900_1950', '2000_2050']);
    expect(combinedStack['1900_1950']['text'].base.countArray[0]).toBe(1);
    expect(combinedStack['2000_2050']['text'].base.countArray[4]).toBe(1);
    
    console.log("✅ Multi-period structure validation complete");
  });

  // Future test for when tags are added to the API
  test("should handle tag processing when tags are added later (disabled for now)", () => {
    // This test is disabled since the current API has no tags
    // Enable this when tags are added to the Amsterdam API
    
    console.log("ℹ️ Tag processing test disabled - no tags in current API data");
    
    // Mock test for future reference - shows how period-first structure works with tags:
    // const accumulator = createHeatmapAccumulator(testGridDimensions);
    // const taggedFeature = { 
    //   ...feature, 
    //   tags: ["historic", "document"] 
    // };
    // processFeatureIntoCounts(taggedFeature, accumulator);
    // const stack = generateHeatmapStack(accumulator, "1900_1950");
    // 
    // expect(accumulator.collectedTags.has("historic")).toBe(true);
    // expect(stack['1900_1950']['text'].tags["historic"]).toBeDefined();
    // expect(stack['1900_1950']['text'].tags["historic"].countArray[0]).toBe(1);
  });

  test("should validate period key generation", () => {
    // Test that period keys are valid and consistent
    const testPeriods = ["1600_1650", "1900_1950", "2000_2025", "test_period"];
    
    for (const period of testPeriods) {
      const accumulator = createHeatmapAccumulator(testGridDimensions);
      const stack = generateHeatmapStack(accumulator, period);
      
      // Should have exactly one period
      expect(Object.keys(stack)).toHaveLength(1);
      expect(Object.keys(stack)[0]).toBe(period);
      
      // Should have all recordtypes
      expect(stack[period]).toHaveProperty('text');
      expect(stack[period]).toHaveProperty('image');  
      expect(stack[period]).toHaveProperty('event');
      
      // Each recordtype should have base and tags
      for (const recordtype of ['text', 'image', 'event'] as const) {
        expect(stack[period][recordtype]).toHaveProperty('base');
        expect(stack[period][recordtype]).toHaveProperty('tags');
        expect(stack[period][recordtype].base.countArray).toHaveLength(9);
        expect(stack[period][recordtype].base.densityArray).toHaveLength(9);
      }
    }
    
    console.log("✅ Period key validation complete");
  });
});

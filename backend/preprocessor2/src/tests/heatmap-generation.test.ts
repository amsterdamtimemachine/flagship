// src/tests/heatmap-generation.test.ts - Pure heatmap generation tests (UPDATED: TimeSlice integration)

import { describe, test, expect } from "bun:test";
import {
  getCellIdForCoordinates,
  processFeatureIntoCounts,
  generateHeatmap,
  createHeatmapAccumulator,
  generateHeatmapStack,
  createTimeSlice,
  createTimeSlices,
  analyzeHeatmapStack,
} from '../processing/heatmap';
import type { TimeSlice } from '../processing';
import type { GridDimensions, AnyProcessedFeature } from '../types/geo';

describe("Heatmap Generation Logic (TimeSlice Integration, Period-First Structure)", () => {
  
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

  // ✅ Test TimeSlices using the new helper functions
  const testTimeSlices: TimeSlice[] = [
    createTimeSlice(1900, 1950),
    createTimeSlice(1950, 2000),
    createTimeSlice(2000, 2025)
  ];

  test("should create TimeSlice objects correctly", () => {
    const timeSlice = createTimeSlice(1900, 1950);
    
    expect(timeSlice.key).toBe("1900_1950");
    expect(timeSlice.label).toBe("1900-1950");
    expect(timeSlice.timeRange.start).toBe("1900-01-01");
    expect(timeSlice.timeRange.end).toBe("1950-12-31");
    expect(timeSlice.startYear).toBe(1900);
    expect(timeSlice.endYear).toBe(1950);
    expect(timeSlice.durationYears).toBe(50);
  });

  test("should create multiple TimeSlices", () => {
    const periods = [
      { start: 1800, end: 1850 },
      { start: 1850, end: 1900 },
      { start: 1900, end: 1950 }
    ];
    
    const timeSlices = createTimeSlices(periods);
    
    expect(timeSlices).toHaveLength(3);
    expect(timeSlices[0].key).toBe("1800_1850");
    expect(timeSlices[1].key).toBe("1850_1900");
    expect(timeSlices[2].key).toBe("1900_1950");
    
    expect(timeSlices[1].durationYears).toBe(50);
    expect(timeSlices[2].timeRange.start).toBe("1900-01-01");
  });

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

  test("should generate correct period-first heatmap stack structure using TimeSlice", () => {
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
    
    // ✅ Generate heatmap stack using TimeSlice
    const timeSlice = testTimeSlices[0]; // 1900-1950
    const heatmapStack = generateHeatmapStack(accumulator, timeSlice);
    
    // ✅ Test period-first structure using TimeSlice key
    expect(heatmapStack).toHaveProperty(timeSlice.key);
    expect(heatmapStack[timeSlice.key]).toHaveProperty('text');
    expect(heatmapStack[timeSlice.key]).toHaveProperty('image');
    expect(heatmapStack[timeSlice.key]).toHaveProperty('event');
    
    // Test text recordtype structure
    expect(heatmapStack[timeSlice.key]['text']).toHaveProperty('base');
    expect(heatmapStack[timeSlice.key]['text']).toHaveProperty('tags');
    
    // Test base heatmap has correct data
    const textBaseHeatmap = heatmapStack[timeSlice.key]['text'].base;
    expect(textBaseHeatmap.countArray).toHaveLength(9); // 3x3 grid
    expect(textBaseHeatmap.densityArray).toHaveLength(9);
    
    // Should have 1 feature in cell 0_0
    expect(textBaseHeatmap.countArray[0]).toBe(1);
    
    // Other recordtypes should be empty (no data)
    expect(heatmapStack[timeSlice.key]['image'].base.countArray[0]).toBe(0);
    expect(heatmapStack[timeSlice.key]['event'].base.countArray[0]).toBe(0);
    
    // Tags should be empty (no tags in test data)
    expect(Object.keys(heatmapStack[timeSlice.key]['text'].tags)).toHaveLength(0);
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

  test("should demonstrate TimeSlice-based multi-period structure access patterns", () => {
    console.log("ℹ️ Testing TimeSlice-based period-first structure access patterns");
    
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
    
    // ✅ Generate stacks for different TimeSlices
    const timeSlice1900 = testTimeSlices[0]; // 1900-1950
    const timeSlice2000 = testTimeSlices[2]; // 2000-2025
    
    const stack1900 = generateHeatmapStack(accumulator, timeSlice1900);
    const stack2000 = generateHeatmapStack(accumulator, timeSlice2000);
    
    // Show access patterns using TimeSlice keys
    console.log("✅ TimeSlice-based access patterns:");
    console.log(`   - stack1900['${timeSlice1900.key}']['text'].base`);
    console.log(`   - stack1900['${timeSlice1900.key}']['text'].tags[tagName]`);
    console.log(`   - TimeSlice info: ${timeSlice1900.label} (${timeSlice1900.durationYears} years)`);
    
    // Verify both periods exist independently using TimeSlice keys
    expect(stack1900).toHaveProperty(timeSlice1900.key);
    expect(stack2000).toHaveProperty(timeSlice2000.key);
    
    // Verify structure
    expect(stack1900[timeSlice1900.key]['text'].base.countArray[0]).toBe(1);
    expect(stack2000[timeSlice2000.key]['text'].base.countArray[0]).toBe(1);
    
    console.log("✅ TimeSlice-based period-first structure working correctly");
  });

  test("should handle multiple TimeSlices in combined analysis", () => {
    // Create separate accumulators for different time periods
    const accumulator1900 = createHeatmapAccumulator(testGridDimensions);
    const accumulator2000 = createHeatmapAccumulator(testGridDimensions);
    
    // Create features for different time periods
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
    processFeatureIntoCounts(earlyFeature, accumulator1900);
    processFeatureIntoCounts(modernFeature, accumulator2000);
    
    // ✅ Generate separate TimeSlice stacks
    const earlyTimeSlice = testTimeSlices[0]; // 1900-1950
    const modernTimeSlice = testTimeSlices[2]; // 2000-2025
    
    const earlyStack = generateHeatmapStack(accumulator1900, earlyTimeSlice);
    const modernStack = generateHeatmapStack(accumulator2000, modernTimeSlice);
    
    // Verify each time period has correct data using TimeSlice keys
    expect(earlyStack[earlyTimeSlice.key]['text'].base.countArray[0]).toBe(1); // Cell 0_0
    expect(earlyStack[earlyTimeSlice.key]['text'].base.countArray[4]).toBe(0); // Cell 1_1 empty
    
    expect(modernStack[modernTimeSlice.key]['text'].base.countArray[0]).toBe(0); // Cell 0_0 empty
    expect(modernStack[modernTimeSlice.key]['text'].base.countArray[4]).toBe(1); // Cell 1_1
    
    // ✅ Manually combine for testing multi-TimeSlice structure
    const combinedStack = {
      ...earlyStack,
      ...modernStack
    };
    
    expect(Object.keys(combinedStack)).toEqual([earlyTimeSlice.key, modernTimeSlice.key]);
    expect(combinedStack[earlyTimeSlice.key]['text'].base.countArray[0]).toBe(1);
    expect(combinedStack[modernTimeSlice.key]['text'].base.countArray[4]).toBe(1);
    
    console.log("✅ Multi-TimeSlice structure validation complete");
    console.log(`   - Early period: ${earlyTimeSlice.label} (key: ${earlyTimeSlice.key})`);
    console.log(`   - Modern period: ${modernTimeSlice.label} (key: ${modernTimeSlice.key})`);
  });

  test("should analyze heatmap stack across TimeSlices", () => {
    // Create test data across multiple TimeSlices
    const testData = [
      { timeSlice: testTimeSlices[0], text: 10, image: 2, event: 1 }, // 1900-1950
      { timeSlice: testTimeSlices[1], text: 20, image: 5, event: 3 }, // 1950-2000
      { timeSlice: testTimeSlices[2], text: 15, image: 1, event: 2 }  // 2000-2025
    ];
    
    // Create mock heatmap stack
    const mockHeatmapStack: any = {};
    
    for (const { timeSlice, text, image, event } of testData) {
      const totalCells = 9; // 3x3 grid
      
      mockHeatmapStack[timeSlice.key] = {
        text: {
          base: {
            countArray: new Array(totalCells).fill(0).map((_, i) => i === 0 ? text : 0),
            densityArray: new Array(totalCells).fill(0)
          },
          tags: {}
        },
        image: {
          base: {
            countArray: new Array(totalCells).fill(0).map((_, i) => i === 1 ? image : 0),
            densityArray: new Array(totalCells).fill(0)
          },
          tags: {}
        },
        event: {
          base: {
            countArray: new Array(totalCells).fill(0).map((_, i) => i === 2 ? event : 0),
            densityArray: new Array(totalCells).fill(0)
          },
          tags: {}
        }
      };
    }
    
    // ✅ Analyze the heatmap stack using TimeSlices
    const analysis = analyzeHeatmapStack(mockHeatmapStack, testTimeSlices);
    
    // Check analysis results
    expect(analysis.totalTimeSlices).toBe(3);
    expect(analysis.totalCells).toBe(9);
    
    // Check recordtype statistics
    expect(analysis.recordtypeStats.text.totalFeatures).toBe(45); // 10+20+15
    expect(analysis.recordtypeStats.image.totalFeatures).toBe(8); // 2+5+1
    expect(analysis.recordtypeStats.event.totalFeatures).toBe(6); // 1+3+2
    
    // Check peak time slices
    expect(analysis.recordtypeStats.text.peakTimeSlice.key).toBe("1950_2000");
    expect(analysis.recordtypeStats.text.peakTimeSlice.count).toBe(20);
    expect(analysis.recordtypeStats.text.peakTimeSlice.label).toBe("1950-2000");
    
    // Check overall statistics
    expect(analysis.overallStats.totalFeatures).toBe(59); // Sum of all features
    expect(analysis.overallStats.peakTimeSlice.key).toBe("1950_2000");
    expect(analysis.overallStats.mostActiveRecordtype).toBe("text");
    
    console.log("✅ HeatmapStack analysis with TimeSlices completed:");
    console.log(`   - Most active period: ${analysis.overallStats.peakTimeSlice.label}`);
    console.log(`   - Most active recordtype: ${analysis.overallStats.mostActiveRecordtype}`);
    console.log(`   - Total features across ${analysis.totalTimeSlices} time slices: ${analysis.overallStats.totalFeatures}`);
  });

  test("should validate TimeSlice key generation and consistency", () => {
    // Test that TimeSlice keys are valid and consistent
    const testPeriods = [
      { start: 1600, end: 1650 },
      { start: 1900, end: 1950 },
      { start: 2000, end: 2025 }
    ];
    
    const timeSlices = createTimeSlices(testPeriods);
    
    for (const timeSlice of timeSlices) {
      const accumulator = createHeatmapAccumulator(testGridDimensions);
      const stack = generateHeatmapStack(accumulator, timeSlice);
      
      // Should have exactly one period using TimeSlice key
      expect(Object.keys(stack)).toHaveLength(1);
      expect(Object.keys(stack)[0]).toBe(timeSlice.key);
      
      // Verify TimeSlice properties
      expect(timeSlice.key).toMatch(/^\d{4}_\d{4}$/); // Format: YYYY_YYYY
      expect(timeSlice.label).toMatch(/^\d{4}-\d{4}$/); // Format: YYYY-YYYY
      expect(timeSlice.durationYears).toBe(timeSlice.endYear - timeSlice.startYear);
      expect(timeSlice.timeRange.start).toBe(`${timeSlice.startYear}-01-01`);
      expect(timeSlice.timeRange.end).toBe(`${timeSlice.endYear}-12-31`);
      
      // Should have all recordtypes
      expect(stack[timeSlice.key]).toHaveProperty('text');
      expect(stack[timeSlice.key]).toHaveProperty('image');  
      expect(stack[timeSlice.key]).toHaveProperty('event');
      
      // Each recordtype should have base and tags
      for (const recordtype of ['text', 'image', 'event'] as const) {
        expect(stack[timeSlice.key][recordtype]).toHaveProperty('base');
        expect(stack[timeSlice.key][recordtype]).toHaveProperty('tags');
        expect(stack[timeSlice.key][recordtype].base.countArray).toHaveLength(9);
        expect(stack[timeSlice.key][recordtype].base.densityArray).toHaveLength(9);
      }
    }
    
    console.log("✅ TimeSlice key validation complete");
    console.log("   - All TimeSlice keys follow YYYY_YYYY format");
    console.log("   - All TimeSlice labels follow YYYY-YYYY format");
    console.log("   - All TimeSlices have consistent time range formatting");
  });

  // Future test for when tags are added to the API
  test("should handle tag processing when tags are added later (disabled for now)", () => {
    // This test is disabled since the current API has no tags
    // Enable this when tags are added to the Amsterdam API
    
    console.log("ℹ️ Tag processing test disabled - no tags in current API data");
    
    // Mock test for future reference - shows how TimeSlice structure works with tags:
    // const accumulator = createHeatmapAccumulator(testGridDimensions);
    // const taggedFeature = { 
    //   ...feature, 
    //   tags: ["historic", "document"] 
    // };
    // processFeatureIntoCounts(taggedFeature, accumulator);
    // const timeSlice = createTimeSlice(1900, 1950);
    // const stack = generateHeatmapStack(accumulator, timeSlice);
    // 
    // expect(accumulator.collectedTags.has("historic")).toBe(true);
    // expect(stack[timeSlice.key]['text'].tags["historic"]).toBeDefined();
    // expect(stack[timeSlice.key]['text'].tags["historic"].countArray[0]).toBe(1);
  });

  test("should demonstrate TimeSlice vs old period string comparison", () => {
    console.log("ℹ️ Demonstrating TimeSlice advantages over old string periods");
    
    // ✅ TimeSlice approach
    const timeSlice = createTimeSlice(1900, 1950);
    console.log("✅ TimeSlice approach:");
    console.log(`   - Structured data: ${JSON.stringify(timeSlice, null, 2)}`);
    console.log(`   - Easy access to: key="${timeSlice.key}", label="${timeSlice.label}"`);
    console.log(`   - Duration calculations: ${timeSlice.durationYears} years`);
    console.log(`   - API-ready timeRange: ${timeSlice.timeRange.start} to ${timeSlice.timeRange.end}`);
    
    // ❌ Old string approach (deprecated)
    const oldPeriodString = "1900_1950";
    console.log("❌ Old string approach:");
    console.log(`   - Just a string: "${oldPeriodString}"`);
    console.log(`   - No metadata, manual parsing required`);
    console.log(`   - No duration info, no API-ready format`);
    
    console.log("✅ TimeSlice provides:");
    console.log("   - Type safety and IntelliSense support");
    console.log("   - Consistent API between heatmaps and histograms");
    console.log("   - Rich metadata for analysis and display");
    console.log("   - Easier debugging and maintenance");
  });
});

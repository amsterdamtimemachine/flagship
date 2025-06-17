// src/tests/histogram-generation.test.ts - Histogram generation tests (period-first structure)

import { describe, test, expect } from "bun:test";
import {
  createHistogramAccumulator,
  createEmptyHistogramBin,
  processFeatureIntoHistogramBin,
  generateHistogram,
  generateHistogramStack,
  generateUnifiedHistogram,
  analyzeHistogram
} from '../processing/histogram';
import type { AnyProcessedFeature } from '../types/geo';
import type { TimeSlice } from '../processing';

describe("Histogram Generation Logic (Period-First Structure)", () => {
  
  // Test time slices
  const testPeriods: TimeSlice[] = [
    {
      key: "1900_1950",
      label: "1900-1950",
      timeRange: { start: "1900-01-01", end: "1950-12-31" },
      startYear: 1900,
      endYear: 1950,
      durationYears: 50
    },
    {
      key: "1950_2000", 
      label: "1950-2000",
      timeRange: { start: "1950-01-01", end: "2000-12-31" },
      startYear: 1950,
      endYear: 2000,
      durationYears: 50
    },
    {
      key: "2000_2025",
      label: "2000-2025", 
      timeRange: { start: "2000-01-01", end: "2025-12-31" },
      startYear: 2000,
      endYear: 2025,
      durationYears: 25
    }
  ];

  test("should create empty histogram accumulator", () => {
    const accumulator = createHistogramAccumulator();
    
    expect(accumulator.bins.size).toBe(0);
    expect(accumulator.collectedTags.size).toBe(0);
    expect(accumulator.maxCount).toBe(0);
    expect(accumulator.contentMaxCounts.text).toBe(0);
    expect(accumulator.contentMaxCounts.image).toBe(0);
    expect(accumulator.contentMaxCounts.event).toBe(0);
  });

  test("should create empty histogram bin", () => {
    const bin = createEmptyHistogramBin("1900_1950");
    
    expect(bin.period).toBe("1900_1950");
    expect(bin.count).toBe(0);
    expect(bin.contentCounts.text).toBe(0);
    expect(bin.contentCounts.image).toBe(0);
    expect(bin.contentCounts.event).toBe(0);
    expect(Object.keys(bin.tagCounts.text)).toHaveLength(0);
    expect(Object.keys(bin.tagCounts.image)).toHaveLength(0);
    expect(Object.keys(bin.tagCounts.event)).toHaveLength(0);
  });

  test("should process text features into histogram bins (no tags)", () => {
    const accumulator = createHistogramAccumulator();
    
    // Create test text features
    const feature1: AnyProcessedFeature = {
      title: "Historical Document 1",
      dataset: "amsterdam_archives",
      url: "http://archives.nl/doc1",
      recordtype: "text",
      tags: [], // No tags in current API
      startYear: 1920,
      endYear: 1930,
      geometry: {
        type: "Point",
        coordinates: {lon: 4.85, lat: 52.35}
      }
    };

    const feature2: AnyProcessedFeature = {
      title: "Historical Document 2",
      dataset: "amsterdam_archives", 
      url: "http://archives.nl/doc2",
      recordtype: "text",
      tags: [], // No tags in current API
      startYear: 1925,
      endYear: 1935,
      geometry: {
        type: "Point",
        coordinates: {lon: 4.87, lat: 52.37}
      }
    };

    const feature3: AnyProcessedFeature = {
      title: "Modern Article",
      dataset: "modern_collection",
      url: "http://modern.nl/article1", 
      recordtype: "text",
      tags: [], // No tags in current API
      startYear: 1960,
      endYear: 1970,
      geometry: {
        type: "Point",
        coordinates: {lon: 4.89, lat: 52.39}
      }
    };

    // Process features into different periods
    processFeatureIntoHistogramBin(feature1, accumulator, "1900_1950");
    processFeatureIntoHistogramBin(feature2, accumulator, "1900_1950");
    processFeatureIntoHistogramBin(feature3, accumulator, "1950_2000");

    // Check accumulator state
    expect(accumulator.bins.size).toBe(2); // Two periods
    expect(accumulator.maxCount).toBe(2); // Max is period 1900_1950 with 2 features
    expect(accumulator.contentMaxCounts.text).toBe(2); // Max text count is 2
    expect(accumulator.collectedTags.size).toBe(0); // No tags

    // Check period 1900_1950
    const bin1900 = accumulator.bins.get("1900_1950");
    expect(bin1900).toBeDefined();
    expect(bin1900!.count).toBe(2);
    expect(bin1900!.contentCounts.text).toBe(2);
    expect(bin1900!.contentCounts.image).toBe(0);
    expect(bin1900!.contentCounts.event).toBe(0);

    // Check period 1950_2000
    const bin1950 = accumulator.bins.get("1950_2000");
    expect(bin1950).toBeDefined();
    expect(bin1950!.count).toBe(1);
    expect(bin1950!.contentCounts.text).toBe(1);
    expect(bin1950!.contentCounts.image).toBe(0);
    expect(bin1950!.contentCounts.event).toBe(0);
  });

  test("should handle multiple recordtypes in same period", () => {
    const accumulator = createHistogramAccumulator();
    
    const textFeature: AnyProcessedFeature = {
      title: "Text Document",
      dataset: "test",
      url: "http://test.com/text",
      recordtype: "text",
      tags: [],
      startYear: 1920,
      endYear: 1930,
      geometry: { type: "Point", coordinates: {lon: 4.85, lat: 52.35} }
    };

    const imageFeature: AnyProcessedFeature = {
      title: "Historical Image",
      dataset: "test",
      url: "http://test.com/image",
      recordtype: "image",
      tags: [],
      startYear: 1925,
      endYear: 1935,
      geometry: { type: "Point", coordinates: {lon: 4.87, lat: 52.37} }
    };

    const eventFeature: AnyProcessedFeature = {
      title: "Historical Event",
      dataset: "test",
      url: "http://test.com/event",
      recordtype: "event",
      tags: [],
      startYear: 1930,
      endYear: 1940,
      geometry: { type: "Point", coordinates: {lon: 4.89, lat: 52.39} }
    };

    // All features in same period
    processFeatureIntoHistogramBin(textFeature, accumulator, "1900_1950");
    processFeatureIntoHistogramBin(imageFeature, accumulator, "1900_1950");
    processFeatureIntoHistogramBin(eventFeature, accumulator, "1900_1950");

    // Check accumulator
    expect(accumulator.bins.size).toBe(1);
    expect(accumulator.maxCount).toBe(3); // Total count for period

    const bin = accumulator.bins.get("1900_1950");
    expect(bin!.count).toBe(3); // Total features in period
    expect(bin!.contentCounts.text).toBe(1);
    expect(bin!.contentCounts.image).toBe(1);
    expect(bin!.contentCounts.event).toBe(1);

    // Check max counts per recordtype
    expect(accumulator.contentMaxCounts.text).toBe(1);
    expect(accumulator.contentMaxCounts.image).toBe(1);
    expect(accumulator.contentMaxCounts.event).toBe(1);
  });

  test("should generate histogram from accumulator", () => {
    const accumulator = createHistogramAccumulator();
    
    // Manually create some test data
    accumulator.bins.set("1900_1950", {
      period: "1900_1950",
      count: 5,
      contentCounts: { text: 3, image: 1, event: 1 },
      tagCounts: { text: {}, image: {}, event: {} }
    });
    
    accumulator.bins.set("1950_2000", {
      period: "1950_2000", 
      count: 8,
      contentCounts: { text: 5, image: 2, event: 1 },
      tagCounts: { text: {}, image: {}, event: {} }
    });
    
    accumulator.maxCount = 8;
    accumulator.contentMaxCounts = { text: 5, image: 2, event: 1 };

    const histogram = generateHistogram(accumulator);

    // Check histogram structure
    expect(histogram.bins).toHaveLength(2);
    expect(histogram.maxCount).toBe(8);
    expect(histogram.contentMaxCounts.text).toBe(5);
    expect(histogram.contentMaxCounts.image).toBe(2);
    expect(histogram.contentMaxCounts.event).toBe(1);

    // Check bins are sorted by period
    expect(histogram.bins[0].period).toBe("1900_1950");
    expect(histogram.bins[1].period).toBe("1950_2000");
    
    // Check bin contents
    expect(histogram.bins[0].count).toBe(5);
    expect(histogram.bins[1].count).toBe(8);
  });

  test("should generate period-first histogram stack structure", () => {
    const accumulator = createHistogramAccumulator();
    
    // Add test data for text recordtype
    const textFeature: AnyProcessedFeature = {
      title: "Test Document",
      dataset: "test",
      url: "http://test.com",
      recordtype: "text",
      tags: [],
      startYear: 1920,
      endYear: 1930,
      geometry: { type: "Point", coordinates: {lon: 4.85, lat: 52.35} }
    };
    
    processFeatureIntoHistogramBin(textFeature, accumulator, "1900_1950");
    
    // Generate histogram stack
    const histogramStack = generateHistogramStack(accumulator, testPeriods);
    
    // ✅ Test period-first structure
    expect(histogramStack).toHaveProperty("1900_1950");
    expect(histogramStack).toHaveProperty("1950_2000");
    expect(histogramStack).toHaveProperty("2000_2025");
    
    // Test recordtype structure under each period
    for (const period of ["1900_1950", "1950_2000", "2000_2025"]) {
      expect(histogramStack[period]).toHaveProperty("text");
      expect(histogramStack[period]).toHaveProperty("image");
      expect(histogramStack[period]).toHaveProperty("event");
      
      // Each recordtype should have base and tags
      expect(histogramStack[period]["text"]).toHaveProperty("base");
      expect(histogramStack[period]["text"]).toHaveProperty("tags");
      expect(histogramStack[period]["image"]).toHaveProperty("base");
      expect(histogramStack[period]["image"]).toHaveProperty("tags");
      expect(histogramStack[period]["event"]).toHaveProperty("base");
      expect(histogramStack[period]["event"]).toHaveProperty("tags");
    }
    
    // Check that period with data has correct count
    expect(histogramStack["1900_1950"]["text"].base.count).toBe(1);
    expect(histogramStack["1900_1950"]["text"].base.contentCounts.text).toBe(1);
    
    // Check that periods without data have zero count
    expect(histogramStack["1950_2000"]["text"].base.count).toBe(0);
    expect(histogramStack["2000_2025"]["text"].base.count).toBe(0);
    
    // Check that other recordtypes have zero count
    expect(histogramStack["1900_1950"]["image"].base.count).toBe(0);
    expect(histogramStack["1900_1950"]["event"].base.count).toBe(0);
  });

  test("should demonstrate period-first access patterns", () => {
    const accumulator = createHistogramAccumulator();
    
    // Add features to different periods
    const earlyFeature: AnyProcessedFeature = {
      title: "Early Document",
      dataset: "test",
      url: "http://test.com/early",
      recordtype: "text",
      tags: [],
      startYear: 1920,
      endYear: 1930,
      geometry: { type: "Point", coordinates: {lon: 4.85, lat: 52.35} }
    };
    
    const modernFeature: AnyProcessedFeature = {
      title: "Modern Document",
      dataset: "test",
      url: "http://test.com/modern",
      recordtype: "text", 
      tags: [],
      startYear: 1980,
      endYear: 1990,
      geometry: { type: "Point", coordinates: {lon: 4.87, lat: 52.37} }
    };
    
    processFeatureIntoHistogramBin(earlyFeature, accumulator, "1900_1950");
    processFeatureIntoHistogramBin(modernFeature, accumulator, "1950_2000");
    
    const histogramStack = generateHistogramStack(accumulator, testPeriods);
    
    console.log("✅ Histogram access patterns:");
    console.log("   - histogramStack['1900_1950']['text'].base");
    console.log("   - histogramStack['1950_2000']['text'].base");
    console.log("   - histogramStack['period']['recordtype'].tags[tagName]");
    
    // Verify access patterns work
    expect(histogramStack["1900_1950"]["text"].base.count).toBe(1);
    expect(histogramStack["1950_2000"]["text"].base.count).toBe(1);
    expect(histogramStack["2000_2025"]["text"].base.count).toBe(0);
    
    console.log("✅ Period-first histogram structure working correctly");
  });

  test("should generate unified histogram from stack", () => {
    const accumulator = createHistogramAccumulator();
    
    // Add diverse test data
    const features = [
      { recordtype: "text" as const, period: "1900_1950", count: 3 },
      { recordtype: "image" as const, period: "1900_1950", count: 1 },
      { recordtype: "text" as const, period: "1950_2000", count: 5 },
      { recordtype: "event" as const, period: "1950_2000", count: 2 },
      { recordtype: "text" as const, period: "2000_2025", count: 8 }
    ];
    
    // Simulate multiple features
    for (const { recordtype, period, count } of features) {
      for (let i = 0; i < count; i++) {
        const feature: AnyProcessedFeature = {
          title: `${recordtype} feature ${i}`,
          dataset: "test",
          url: `http://test.com/${recordtype}${i}`,
          recordtype,
          tags: [],
          startYear: 1920,
          endYear: 1930,
          geometry: { type: "Point", coordinates: {lon: 4.85, lat: 52.35} }
        };
        processFeatureIntoHistogramBin(feature, accumulator, period);
      }
    }
    
    const histogramStack = generateHistogramStack(accumulator, testPeriods);
    const unifiedHistogram = generateUnifiedHistogram(histogramStack);
    
    // Check unified histogram structure
    expect(unifiedHistogram.bins).toHaveLength(3); // Three periods
    expect(unifiedHistogram.bins[0].period).toBe("1900_1950");
    expect(unifiedHistogram.bins[1].period).toBe("1950_2000");
    expect(unifiedHistogram.bins[2].period).toBe("2000_2025");
    
    // Check aggregated counts
    expect(unifiedHistogram.bins[0].count).toBe(4); // 3 text + 1 image
    expect(unifiedHistogram.bins[1].count).toBe(7); // 5 text + 2 event
    expect(unifiedHistogram.bins[2].count).toBe(8); // 8 text
    
    // Check content counts
    expect(unifiedHistogram.bins[0].contentCounts.text).toBe(3);
    expect(unifiedHistogram.bins[0].contentCounts.image).toBe(1);
    expect(unifiedHistogram.bins[0].contentCounts.event).toBe(0);
    
    expect(unifiedHistogram.bins[1].contentCounts.text).toBe(5);
    expect(unifiedHistogram.bins[1].contentCounts.image).toBe(0);
    expect(unifiedHistogram.bins[1].contentCounts.event).toBe(2);
    
    // Check max counts
    expect(unifiedHistogram.maxCount).toBe(8);
    expect(unifiedHistogram.contentMaxCounts.text).toBe(8);
    expect(unifiedHistogram.contentMaxCounts.image).toBe(1);
    expect(unifiedHistogram.contentMaxCounts.event).toBe(2);
  });

  test("should analyze histogram data correctly", () => {
    const accumulator = createHistogramAccumulator();
    
    // Create test data with known distribution
    const testData = [
      { period: "1900_1950", text: 10, image: 2, event: 1 },
      { period: "1950_2000", text: 20, image: 5, event: 3 },
      { period: "2000_2025", text: 15, image: 1, event: 2 }
    ];
    
    // Simulate the data
    for (const { period, text, image, event } of testData) {
      const totalForPeriod = text + image + event;
      accumulator.bins.set(period, {
        period,
        count: totalForPeriod,
        contentCounts: { text, image, event },
        tagCounts: { text: {}, image: {}, event: {} }
      });
    }
    
    accumulator.maxCount = 28; // 1950_2000 total
    accumulator.contentMaxCounts = { text: 20, image: 5, event: 3 };
    
    const histogram = generateHistogram(accumulator);
    const analysis = analyzeHistogram(histogram);
    
    // Check analysis results
    expect(analysis.totalFeatures).toBe(59); // Sum of all features
    expect(analysis.totalPeriods).toBe(3);
    expect(analysis.peakPeriod.period).toBe("1950_2000");
    expect(analysis.peakPeriod.count).toBe(28);
    expect(analysis.averagePerPeriod).toBe(20); // 59/3 rounded
    
    // Check recordtype distribution
    expect(analysis.recordtypeDistribution.text).toBe(45); // 10+20+15
    expect(analysis.recordtypeDistribution.image).toBe(8); // 2+5+1
    expect(analysis.recordtypeDistribution.event).toBe(6); // 1+3+2
    
    // Check time span
    expect(analysis.timeSpan.start).toBe("1900_1950");
    expect(analysis.timeSpan.end).toBe("2000_2025");
  });

  test("should handle empty accumulator gracefully", () => {
    const accumulator = createHistogramAccumulator();
    const histogram = generateHistogram(accumulator);
    
    expect(histogram.bins).toHaveLength(0);
    expect(histogram.maxCount).toBe(0);
    expect(histogram.contentMaxCounts.text).toBe(0);
    expect(histogram.contentMaxCounts.image).toBe(0);
    expect(histogram.contentMaxCounts.event).toBe(0);
  });

  test("should handle tag processing when tags are added later (disabled for now)", () => {
    console.log("ℹ️ Tag processing test disabled - no tags in current API data");
    
    // Mock test for future reference - shows how period-first structure works with tags:
    // const accumulator = createHistogramAccumulator();
    // const taggedFeature = { 
    //   ...feature, 
    //   tags: ["historic", "document"] 
    // };
    // processFeatureIntoHistogramBin(taggedFeature, accumulator, "1900_1950");
    // 
    // expect(accumulator.collectedTags.has("historic")).toBe(true);
    // const histogramStack = generateHistogramStack(accumulator, testPeriods);
    // expect(histogramStack['1900_1950']['text'].tags["historic"]).toBeDefined();
    // expect(histogramStack['1900_1950']['text'].tags["historic"].count).toBe(1);
  });

  test("should validate period consistency across functions", () => {
    const accumulator = createHistogramAccumulator();
    const testPeriodKeys = ["1600_1650", "1900_1950", "2000_2025"];
    
    // Process features into different periods
    for (const periodKey of testPeriodKeys) {
      const feature: AnyProcessedFeature = {
        title: `Document for ${periodKey}`,
        dataset: "test",
        url: `http://test.com/${periodKey}`,
        recordtype: "text",
        tags: [],
        startYear: 1920,
        endYear: 1930,
        geometry: { type: "Point", coordinates: {lon: 4.85, lat: 52.35} }
      };
      
      processFeatureIntoHistogramBin(feature, accumulator, periodKey);
    }
    
    // Check accumulator has all periods
    expect(accumulator.bins.size).toBe(3);
    for (const periodKey of testPeriodKeys) {
      expect(accumulator.bins.has(periodKey)).toBe(true);
      expect(accumulator.bins.get(periodKey)!.period).toBe(periodKey);
    }
    
    // Generate histogram and check period order
    const histogram = generateHistogram(accumulator);
    const sortedPeriods = histogram.bins.map(bin => bin.period);
    expect(sortedPeriods).toEqual(["1600_1650", "1900_1950", "2000_2025"]);
    
    console.log("✅ Period consistency validation complete");
  });

  test("should demonstrate temporal aggregation vs spatial aggregation", () => {
    console.log("ℹ️ Demonstrating temporal aggregation (histograms) vs spatial aggregation (heatmaps)");
    
    const accumulator = createHistogramAccumulator();
    
    // Same features in different locations but same time period
    const features = [
      { coords: {lon: 4.85, lat: 52.35}, title: "Document A" },
      { coords: {lon: 4.87, lat: 52.37}, title: "Document B" }, 
      { coords: {lon: 4.89, lat: 52.39}, title: "Document C" }
    ];
    
    // All features go to same temporal bin (regardless of location)
    for (const { coords, title } of features) {
      const feature: AnyProcessedFeature = {
        title,
        dataset: "test",
        url: `http://test.com/${title}`,
        recordtype: "text",
        tags: [],
        startYear: 1920,
        endYear: 1930,
        geometry: { type: "Point", coordinates: coords }
      };
      
      processFeatureIntoHistogramBin(feature, accumulator, "1900_1950");
    }
    
    // All features aggregated into single temporal bin
    expect(accumulator.bins.size).toBe(1);
    expect(accumulator.bins.get("1900_1950")!.count).toBe(3);
    
    console.log("✅ Temporal aggregation: 3 features → 1 time bin");
    console.log("   - Heatmaps: same features → 3 spatial cells (by coordinates)");
    console.log("   - Histograms: same features → 1 temporal bin (by time period)");
    console.log("   - Complementary views of same data!");
  });
});

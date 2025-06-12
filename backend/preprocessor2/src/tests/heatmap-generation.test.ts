// src/tests/heatmap-generation.test.ts - Test heatmap generation with streaming

import { describe, test, expect } from "bun:test";
import {
  generateHeatmapsForRecordtype,
  generateHeatmapBlueprint,
  getCellIdForCoordinates,
  calculateCellBounds,
  createHeatmapAccumulator,
  processFeatureIntoCounts
} from '../processing';
import { AMSTERDAM_DATABASE_CONFIG, AMSTERDAM_BOUNDS } from '../config/defaults';
import type { GridDimensions } from '../types/geo';

describe("Heatmap Generation", () => {
  
  const testGridDimensions: GridDimensions = {
    colsAmount: 10,
    rowsAmount: 10,
    cellWidth: (AMSTERDAM_BOUNDS.maxLon - AMSTERDAM_BOUNDS.minLon) / 10,
    cellHeight: (AMSTERDAM_BOUNDS.maxLat - AMSTERDAM_BOUNDS.minLat) / 10,
    minLon: AMSTERDAM_BOUNDS.minLon,
    maxLon: AMSTERDAM_BOUNDS.maxLon,
    minLat: AMSTERDAM_BOUNDS.minLat,
    maxLat: AMSTERDAM_BOUNDS.maxLat
  };

  test("should generate heatmap blueprint correctly", () => {
    const blueprint = generateHeatmapBlueprint(testGridDimensions);
    
    expect(blueprint.rows).toBe(10);
    expect(blueprint.cols).toBe(10);
    expect(blueprint.cells).toHaveLength(100); // 10x10 grid
    
    // Test first cell
    const firstCell = blueprint.cells[0];
    expect(firstCell.cellId).toBe("0_0");
    expect(firstCell.row).toBe(0);
    expect(firstCell.col).toBe(0);
    expect(firstCell.bounds).toHaveProperty('minLon');
    expect(firstCell.bounds).toHaveProperty('maxLon');
    expect(firstCell.bounds).toHaveProperty('minLat');
    expect(firstCell.bounds).toHaveProperty('maxLat');
    
    // Test last cell
    const lastCell = blueprint.cells[99];
    expect(lastCell.cellId).toBe("9_9");
    expect(lastCell.row).toBe(9);
    expect(lastCell.col).toBe(9);
  });

  test("should calculate cell ID correctly for coordinates", () => {
    // Test coordinates in center of Amsterdam
    const centerCoordinates = {
      lon: (AMSTERDAM_BOUNDS.minLon + AMSTERDAM_BOUNDS.maxLon) / 2,
      lat: (AMSTERDAM_BOUNDS.minLat + AMSTERDAM_BOUNDS.maxLat) / 2
    };
    
    const cellId = getCellIdForCoordinates(centerCoordinates, testGridDimensions);
    expect(cellId).toBe("5_5"); // Should be in middle cell
    
    // Test coordinates outside bounds
    const outsideCoordinates = { lon: -1, lat: -1 };
    const outsideCellId = getCellIdForCoordinates(outsideCoordinates, testGridDimensions);
    expect(outsideCellId).toBeNull();
  });

  test("should calculate cell bounds correctly", () => {
    const bounds = calculateCellBounds(0, 0, testGridDimensions);
    
    expect(bounds.minLon).toBeCloseTo(AMSTERDAM_BOUNDS.minLon, 5);
    expect(bounds.minLat).toBeCloseTo(AMSTERDAM_BOUNDS.minLat, 5);
    expect(bounds.maxLon).toBeGreaterThan(bounds.minLon);
    expect(bounds.maxLat).toBeGreaterThan(bounds.minLat);
    
    // Test cell size consistency
    const cellWidth = bounds.maxLon - bounds.minLon;
    const cellHeight = bounds.maxLat - bounds.minLat;
    
    expect(cellWidth).toBeCloseTo(testGridDimensions.cellWidth, 5);
    expect(cellHeight).toBeCloseTo(testGridDimensions.cellHeight, 5);
  });

  test("should create and use heatmap accumulator correctly", () => {
    const accumulator = createHeatmapAccumulator(testGridDimensions);
    
    expect(accumulator.cellCounts.base).toBeInstanceOf(Map);
    expect(accumulator.cellCounts.tags).toBeInstanceOf(Map);
    expect(accumulator.collectedTags).toBeInstanceOf(Set);
    expect(accumulator.gridDimensions).toBe(testGridDimensions);
    
    // Test processing a mock feature
    const mockFeature = {
      title: "Test Feature",
      dataset: "test",
      url: "https://test.com",
      recordtype: 'text' as const,
      tags: ["building", "historic"],
      startYear: 1900,
      endYear: 1900,
      geometry: {
        type: 'Point' as const,
        coordinates: {
          lon: (AMSTERDAM_BOUNDS.minLon + AMSTERDAM_BOUNDS.maxLon) / 2, // Center lon
          lat: (AMSTERDAM_BOUNDS.minLat + AMSTERDAM_BOUNDS.maxLat) / 2   // Center lat
        }
      }
    };
    
    processFeatureIntoCounts(mockFeature, accumulator);
    
    // Check base counts
    expect(accumulator.cellCounts.base.has('text')).toBe(true);
    expect(accumulator.cellCounts.base.get('text')?.get('5_5')).toBe(1);
    
    // Check tag collection
    expect(accumulator.collectedTags.has('building')).toBe(true);
    expect(accumulator.collectedTags.has('historic')).toBe(true);
    
    // Check tag counts
    expect(accumulator.cellCounts.tags.has('building')).toBe(true);
    expect(accumulator.cellCounts.tags.get('building')?.get('text')?.get('5_5')).toBe(1);
  });

  test("should generate heatmaps for text recordtype with real API", async () => {
    console.log("🧪 Starting real API heatmap generation test...");
    
    const chunkConfig = {
      chunkRows: 2,
      chunkCols: 2,
      overlap: 0.001,
      delayMs: 200
    };
    
    // Use smaller bounds for faster testing
    const testBounds = {
      minLon: 4.85,
      minLat: 52.35,
      maxLon: 4.9,
      maxLat: 52.37
    };
    
    const timeRange = {
      start: '1900-01-01',
      end: '1950-01-01'
    };
    
    try {
      const heatmapStack = await generateHeatmapsForRecordtype(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        chunkConfig,
        'text',
        testGridDimensions,
        timeRange
      );
      
      // Test structure
      expect(heatmapStack).toHaveProperty('base');
      expect(heatmapStack).toHaveProperty('tags');
      
      // Test base heatmaps
      expect(heatmapStack.base).toHaveProperty('text');
      expect(heatmapStack.base).toHaveProperty('image');
      expect(heatmapStack.base).toHaveProperty('event');
      
      // Test text heatmap specifically (should have data)
      const textHeatmap = heatmapStack.base.text;
      expect(textHeatmap).toHaveProperty('countArray');
      expect(textHeatmap).toHaveProperty('densityArray');
      expect(textHeatmap.countArray).toHaveLength(100); // 10x10 grid
      expect(textHeatmap.densityArray).toHaveLength(100);
      
      // Check if we got any data
      const totalCounts = Array.from(textHeatmap.countArray).reduce((sum, count) => sum + count, 0);
      console.log(`📊 Total features found: ${totalCounts}`);
      
      // Test that image and event heatmaps are empty (since we only streamed 'text')
      const imageTotalCounts = Array.from(heatmapStack.base.image.countArray).reduce((sum, count) => sum + count, 0);
      const eventTotalCounts = Array.from(heatmapStack.base.event.countArray).reduce((sum, count) => sum + count, 0);
      
      expect(imageTotalCounts).toBe(0);
      expect(eventTotalCounts).toBe(0);
      
      // Test density values are between 0 and 1
      for (let i = 0; i < textHeatmap.densityArray.length; i++) {
        expect(textHeatmap.densityArray[i]).toBeGreaterThanOrEqual(0);
        expect(textHeatmap.densityArray[i]).toBeLessThanOrEqual(1);
      }
      
      console.log(`✅ Heatmap generation successful!`);
      console.log(`   - Text features: ${totalCounts}`);
      console.log(`   - Tags collected: ${Object.keys(heatmapStack.tags).length}`);
      console.log(`   - Non-zero cells: ${Array.from(textHeatmap.countArray).filter(c => c > 0).length}`);
      
    } catch (error) {
      console.error("❌ Heatmap generation failed:", error);
      throw error;
    }
  }, 30000); // 30 second timeout for API calls

  test("should generate heatmaps for image recordtype with real API", async () => {
    console.log("🧪 Starting image heatmap generation test...");
    
    const chunkConfig = {
      chunkRows: 2,
      chunkCols: 2,
      overlap: 0.001,
      delayMs: 200
    };
    
    const testBounds = {
      minLon: 4.85,
      minLat: 52.35,
      maxLon: 4.9,
      maxLat: 52.37
    };
    
    const timeRange = {
      start: '1900-01-01',
      end: '1950-01-01'
    };
    
    try {
      const heatmapStack = await generateHeatmapsForRecordtype(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        chunkConfig,
        'image',
        testGridDimensions,
        timeRange
      );
      
      // Test that image heatmap has data and others are empty
      const imageTotalCounts = Array.from(heatmapStack.base.image.countArray).reduce((sum, count) => sum + count, 0);
      const textTotalCounts = Array.from(heatmapStack.base.text.countArray).reduce((sum, count) => sum + count, 0);
      const eventTotalCounts = Array.from(heatmapStack.base.event.countArray).reduce((sum, count) => sum + count, 0);
      
      console.log(`📊 Image features found: ${imageTotalCounts}`);
      
      expect(textTotalCounts).toBe(0);
      expect(eventTotalCounts).toBe(0);
      
      // Image might have data or might be empty depending on API
      if (imageTotalCounts > 0) {
        console.log(`✅ Found ${imageTotalCounts} image features`);
      } else {
        console.log(`ℹ️ No image features found in test area/timerange`);
      }
      
    } catch (error) {
      console.error("❌ Image heatmap generation failed:", error);
      throw error;
    }
  }, 30000);

  test("should handle empty results gracefully", async () => {
    console.log("🧪 Testing empty results handling...");
    
    const chunkConfig = {
      chunkRows: 1,
      chunkCols: 1,
      delayMs: 100
    };
    
    // Use bounds with no data
    const emptyBounds = {
      minLon: -1,
      minLat: -1,
      maxLon: -0.9,
      maxLat: -0.9
    };
    
    const timeRange = {
      start: '1800-01-01',
      end: '1801-01-01'
    };
    
    try {
      const heatmapStack = await generateHeatmapsForRecordtype(
        AMSTERDAM_DATABASE_CONFIG,
        emptyBounds,
        chunkConfig,
        'text',
        testGridDimensions,
        timeRange
      );
      
      // Should return valid structure with all zeros
      const totalCounts = Array.from(heatmapStack.base.text.countArray).reduce((sum, count) => sum + count, 0);
      expect(totalCounts).toBe(0);
      
      // Density should all be 0
      const maxDensity = Math.max(...Array.from(heatmapStack.base.text.densityArray));
      expect(maxDensity).toBe(0);
      
      console.log(`✅ Empty results handled correctly`);
      
    } catch (error) {
      console.error("❌ Empty results test failed:", error);
      throw error;
    }
  }, 15000);
});

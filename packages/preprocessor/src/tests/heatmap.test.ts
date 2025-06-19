// src/processing/heatmap.test.ts - Clean heatmap generation tests

import { describe, test, expect } from "bun:test";
import {
  getCellIdForCoordinates,
  calculateCellBounds,
  processFeatureIntoCounts,
  generateHeatmap,
  generateHeatmapBlueprint,
  createHeatmapAccumulator,
  generateHeatmapTimelineFromAccumulator,
  createTimeSlice,
  createTimeSlices,
  getFeatureCoordinates,
} from '../processing/heatmap';
import type { 
  TimeSlice,
  HeatmapDimensions, 
  AnyProcessedFeature,
  HeatmapResolutionConfig
} from '@atm/shared/types';

describe("Heatmap Generation Logic", () => {
  
  // Use clean 3x3 grid to avoid floating point precision issues
  const testHeatmapDimensions: HeatmapDimensions = {
    colsAmount: 3,
    rowsAmount: 3,
    cellWidth: 0.1,
    cellHeight: 0.1,
    minLon: 4.8,
    maxLon: 5.1,
    minLat: 52.3,
    maxLat: 52.6
  };

  // Test TimeSlices
  const testTimeSlices: TimeSlice[] = [
    createTimeSlice(1900, 1950),
    createTimeSlice(1950, 2000),
    createTimeSlice(2000, 2025)
  ];

  describe("TimeSlice Creation", () => {
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

    test("should handle different TimeSlice formats", () => {
      const hyphenKey = createTimeSlice(1900, 1950, { keyFormat: 'hyphen' });
      const toLabelFormat = createTimeSlice(1900, 1950, { labelFormat: 'to' });
      
      expect(hyphenKey.key).toBe("1900-1950");
      expect(toLabelFormat.label).toBe("1900 to 1950");
    });
  });

  describe("Coordinate System", () => {
    test("should calculate correct cell IDs for coordinates", () => {
      // Test center of each cell in 3x3 grid
      expect(getCellIdForCoordinates({lon: 4.85, lat: 52.35}, testHeatmapDimensions)).toBe("0_0");
      expect(getCellIdForCoordinates({lon: 4.95, lat: 52.35}, testHeatmapDimensions)).toBe("0_1");
      expect(getCellIdForCoordinates({lon: 5.05, lat: 52.35}, testHeatmapDimensions)).toBe("0_2");
      
      expect(getCellIdForCoordinates({lon: 4.85, lat: 52.45}, testHeatmapDimensions)).toBe("1_0");
      expect(getCellIdForCoordinates({lon: 4.95, lat: 52.45}, testHeatmapDimensions)).toBe("1_1");
      expect(getCellIdForCoordinates({lon: 5.05, lat: 52.45}, testHeatmapDimensions)).toBe("1_2");
      
      expect(getCellIdForCoordinates({lon: 4.85, lat: 52.55}, testHeatmapDimensions)).toBe("2_0");
      expect(getCellIdForCoordinates({lon: 4.95, lat: 52.55}, testHeatmapDimensions)).toBe("2_1");
      expect(getCellIdForCoordinates({lon: 5.05, lat: 52.55}, testHeatmapDimensions)).toBe("2_2");
    });

    test("should handle coordinates outside grid bounds", () => {
      expect(getCellIdForCoordinates({lon: 4.7, lat: 52.35}, testHeatmapDimensions)).toBe(null);  // Too far west
      expect(getCellIdForCoordinates({lon: 5.2, lat: 52.35}, testHeatmapDimensions)).toBe(null);  // Too far east
      expect(getCellIdForCoordinates({lon: 4.85, lat: 52.2}, testHeatmapDimensions)).toBe(null);  // Too far south
      expect(getCellIdForCoordinates({lon: 4.85, lat: 52.7}, testHeatmapDimensions)).toBe(null);  // Too far north
    });

    test("should handle grid boundary coordinates correctly", () => {
      // Test exact boundary coordinates
      expect(getCellIdForCoordinates({lon: 4.8, lat: 52.3}, testHeatmapDimensions)).toBe("0_0");   // Min corner
      expect(getCellIdForCoordinates({lon: 5.1, lat: 52.6}, testHeatmapDimensions)).toBe(null);    // Max corner (exclusive)
      expect(getCellIdForCoordinates({lon: 5.099, lat: 52.599}, testHeatmapDimensions)).toBe("2_2"); // Just inside max
    });

    test("should calculate cell bounds correctly", () => {
      const bounds_0_0 = calculateCellBounds(0, 0, testHeatmapDimensions);
      expect(bounds_0_0.minlon).toBeCloseTo(4.8);
      expect(bounds_0_0.maxlon).toBeCloseTo(4.9);
      expect(bounds_0_0.minlat).toBeCloseTo(52.3);
      expect(bounds_0_0.maxlat).toBeCloseTo(52.4);

      const bounds_2_2 = calculateCellBounds(2, 2, testHeatmapDimensions);
      expect(bounds_2_2.minlon).toBeCloseTo(5.0);
      expect(bounds_2_2.maxlon).toBeCloseTo(5.1);
      expect(bounds_2_2.minlat).toBeCloseTo(52.5);
      expect(bounds_2_2.maxlat).toBeCloseTo(52.6);
    });
  });

  describe("Feature Processing", () => {
    test("should correctly count text features in cells", () => {
      const accumulator = createHeatmapAccumulator(testHeatmapDimensions);
      
      // Create test text features (matching real API data structure)
      const feature1: AnyProcessedFeature = {
        title: "Historical Document 1",
        dataset: "amsterdam_archives",
        url: "http://archives.nl/doc1",
        recordType: "text",
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
        recordType: "text",
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
        recordType: "text",
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

      // Check base counts for text recordType only
      const textCounts = accumulator.cellcounts.base.get("text");
      expect(textCounts?.get("0_0")).toBe(2); // Two text features in cell 0_0
      expect(textCounts?.get("1_1")).toBe(1); // One text feature in cell 1_1
      expect(textCounts?.get("0_1")).toBeUndefined(); // No features in cell 0_1

      // Verify no tags were collected (since all features have empty tags)
      expect(accumulator.collectedtags.size).toBe(0);

      // Verify tag counts are empty
      expect(accumulator.cellcounts.tags.size).toBe(0);
    });

    test("should extract coordinates from different geometry types", () => {
      const pointFeature: AnyProcessedFeature = {
        title: "Point Feature",
        dataset: "test",
        url: "http://test.com",
        recordType: "text",
        tags: [],
        startYear: 1900,
        endYear: 2000,
        geometry: {
          type: "Point",
          coordinates: { lon: 4.85, lat: 52.35 }
        }
      };

      const lineFeature: AnyProcessedFeature = {
        title: "Line Feature",
        dataset: "test",
        url: "http://test.com",
        recordType: "text",
        tags: [],
        startYear: 1900,
        endYear: 2000,
        geometry: {
          type: "LineString",
          coordinates: [
            { lon: 4.8, lat: 52.3 },
            { lon: 4.9, lat: 52.4 }
          ],
          centroid: { lon: 4.85, lat: 52.35 }
        }
      };

      expect(getFeatureCoordinates(pointFeature)).toEqual({ lon: 4.85, lat: 52.35 });
      expect(getFeatureCoordinates(lineFeature)).toEqual({ lon: 4.85, lat: 52.35 });
    });

    test("should handle features outside grid bounds", () => {
      const accumulator = createHeatmapAccumulator(testHeatmapDimensions);
      
      const outsideFeature: AnyProcessedFeature = {
        title: "Outside Feature",
        dataset: "test",
        url: "http://test.com",
        recordType: "text",
        tags: [],
        startYear: 1900,
        endYear: 2000,
        geometry: {
          type: "Point",
          coordinates: { lon: 10.0, lat: 60.0 } // Way outside bounds
        }
      };

      processFeatureIntoCounts(outsideFeature, accumulator);

      // Should have no data since feature is outside bounds
      expect(accumulator.cellcounts.base.size).toBe(0);
      expect(accumulator.collectedtags.size).toBe(0);
    });
  });

  describe("Heatmap Generation", () => {
    test("should generate correct heatmap arrays from count data", () => {
      // Create test count data
      const counts = new Map<string, number>();
      counts.set("0_0", 5);  // 5 features in top-left
      counts.set("1_1", 10); // 10 features in center
      counts.set("2_2", 2);  // 2 features in bottom-right

      const heatmap = generateHeatmap(counts, testHeatmapDimensions);

      // Check array length
      expect(heatmap.countarray).toHaveLength(9); // 3x3 grid
      expect(heatmap.densityarray).toHaveLength(9);

      // Check count values (row-major order)
      expect(heatmap.countarray[0]).toBe(5);  // Cell 0_0 -> index 0
      expect(heatmap.countarray[4]).toBe(10); // Cell 1_1 -> index 4 (1*3 + 1)
      expect(heatmap.countarray[8]).toBe(2);  // Cell 2_2 -> index 8 (2*3 + 2)
      
      // Other cells should be 0
      expect(heatmap.countarray[1]).toBe(0);
      expect(heatmap.countarray[2]).toBe(0);
      expect(heatmap.countarray[3]).toBe(0);

      // Check density calculation (log normalization)
      const maxCount = 10;
      const maxTransformed = Math.log(maxCount + 1);
      
      expect(heatmap.densityarray[0]).toBeCloseTo(Math.log(6) / maxTransformed, 5); // log(5+1) / log(10+1)
      expect(heatmap.densityarray[4]).toBeCloseTo(1.0, 5); // log(10+1) / log(10+1) = 1.0
      expect(heatmap.densityarray[8]).toBeCloseTo(Math.log(3) / maxTransformed, 5); // log(2+1) / log(10+1)
      
      // Empty cells should have 0 density
      expect(heatmap.densityarray[1]).toBe(0);
      expect(heatmap.densityarray[2]).toBe(0);
    });

    test("should handle empty count map", () => {
      const counts = new Map<string, number>();
      const heatmap = generateHeatmap(counts, testHeatmapDimensions);

      expect(heatmap.countarray).toHaveLength(9);
      expect(heatmap.densityarray).toHaveLength(9);
      
      // All cells should be 0
      expect(Array.from(heatmap.countarray)).toEqual([0,0,0,0,0,0,0,0,0]);
      expect(Array.from(heatmap.densityarray)).toEqual([0,0,0,0,0,0,0,0,0]);
    });

    test("should generate heatmap blueprint correctly", () => {
      const blueprint = generateHeatmapBlueprint(testHeatmapDimensions);
      
      expect(blueprint.rows).toBe(3);
      expect(blueprint.cols).toBe(3);
      expect(blueprint.cells).toHaveLength(9);
      
      // Check first cell
      const firstCell = blueprint.cells[0];
      expect(firstCell.cellid).toBe('0_0');
      expect(firstCell.row).toBe(0);
      expect(firstCell.col).toBe(0);
      expect(firstCell.bounds.minlon).toBeCloseTo(4.8);
      expect(firstCell.bounds.minlat).toBeCloseTo(52.3);
      
      // Check last cell
      const lastCell = blueprint.cells[8];
      expect(lastCell.cellid).toBe('2_2');
      expect(lastCell.row).toBe(2);
      expect(lastCell.col).toBe(2);
      expect(lastCell.bounds.maxlon).toBeCloseTo(5.1);
      expect(lastCell.bounds.maxlat).toBeCloseTo(52.6);
    });
  });

  describe("Timeline Generation", () => {
    test("should generate correct timeline structure using TimeSlice", () => {
      const accumulator = createHeatmapAccumulator(testHeatmapDimensions);
      
      // Add test feature to accumulator
      const feature: AnyProcessedFeature = {
        title: "Test Document",
        dataset: "test",
        url: "http://test.com",
        recordType: "text",
        tags: [], // No tags for now
        startYear: 1900,
        endYear: 1910,
        geometry: {
          type: "Point",
          coordinates: {lon: 4.85, lat: 52.35} // Cell 0_0
        }
      };
      
      processFeatureIntoCounts(feature, accumulator);
      
      // Generate heatmap timeline using TimeSlice
      const timeSlice = testTimeSlices[0]; // 1900-1950
      const heatmapTimeline = generateHeatmapTimelineFromAccumulator(accumulator, timeSlice);
      
      // Test timeline structure using TimeSlice key
      expect(heatmapTimeline).toHaveProperty(timeSlice.key);
      expect(heatmapTimeline[timeSlice.key]).toHaveProperty('text');
      expect(heatmapTimeline[timeSlice.key]).toHaveProperty('image');
      expect(heatmapTimeline[timeSlice.key]).toHaveProperty('event');
      
      // Test text recordType structure
      expect(heatmapTimeline[timeSlice.key]['text']).toHaveProperty('base');
      expect(heatmapTimeline[timeSlice.key]['text']).toHaveProperty('tags');
      
      // Test base heatmap has correct data
      const textBaseHeatmap = heatmapTimeline[timeSlice.key]['text'].base;
      expect(textBaseHeatmap.countarray).toHaveLength(9); // 3x3 grid
      expect(textBaseHeatmap.densityarray).toHaveLength(9);
      
      // Should have 1 feature in cell 0_0
      expect(textBaseHeatmap.countarray[0]).toBe(1);
      
      // Other recordTypes should be empty (no data)
      expect(heatmapTimeline[timeSlice.key]['image'].base.countarray[0]).toBe(0);
      expect(heatmapTimeline[timeSlice.key]['event'].base.countarray[0]).toBe(0);
      
      // Tags should be empty (no tags in test data)
      expect(Object.keys(heatmapTimeline[timeSlice.key]['text'].tags)).toHaveLength(0);
    });
  });

  describe("Multi-Resolution Generation", () => {
    test("should generate heatmaps at different resolutions", () => {
      // Test different resolutions
      const resolutions: HeatmapResolutionConfig[] = [
        { cols: 2, rows: 2 },   // 4 cells
        { cols: 3, rows: 3 },   // 9 cells  
        { cols: 4, rows: 4 },   // 16 cells
        { cols: 8, rows: 8 }    // 64 cells
      ];

      for (const resolution of resolutions) {
        const dimensions: HeatmapDimensions = {
          colsAmount: resolution.cols,
          rowsAmount: resolution.rows,
          cellWidth: (5.1 - 4.8) / resolution.cols,
          cellHeight: (52.6 - 52.3) / resolution.rows,
          minLon: 4.8,
          maxLon: 5.1,
          minLat: 52.3,
          maxLat: 52.6
        };

        const accumulator = createHeatmapAccumulator(dimensions);
        
        // Use coordinate that reliably maps to cell 0_0 for any resolution
        const feature: AnyProcessedFeature = {
          title: "Test Feature",
          dataset: "test",
          url: "http://test.com",
          recordType: "text",
          tags: [],
          startYear: 1900,
          endYear: 2000,
          geometry: {
            type: "Point",
            coordinates: { lon: 4.81, lat: 52.31 } // Slightly inside bounds, should always be cell 0_0
          }
        };
        
        // Debug: Check which cell this coordinate maps to
        const cellId = getCellIdForCoordinates(feature.geometry.coordinates, dimensions);
        console.log(`${resolution.cols}x${resolution.rows}: (${feature.geometry.coordinates.lon}, ${feature.geometry.coordinates.lat}) -> ${cellId}`);
        
        processFeatureIntoCounts(feature, accumulator);
        
        const timeSlice = createTimeSlice(1900, 2000);
        const timeline = generateHeatmapTimelineFromAccumulator(accumulator, timeSlice);
        
        const totalCells = resolution.cols * resolution.rows;
        const heatmap = timeline[timeSlice.key]['text'].base;
        
        // Verify grid size
        expect(heatmap.countarray).toHaveLength(totalCells);
        expect(heatmap.densityarray).toHaveLength(totalCells);
        
        // Verify total features across all cells
        const totalFeatures = heatmap.countarray.reduce((sum, count) => sum + count, 0);
        expect(totalFeatures).toBe(1);
        
        // Find which cell actually has the feature
        const cellWithFeature = heatmap.countarray.findIndex(count => count > 0);
        expect(cellWithFeature).toBeGreaterThanOrEqual(0); // Should find at least one cell with data
        expect(heatmap.countarray[cellWithFeature]).toBe(1);
        
        console.log(`✅ ${resolution.cols}x${resolution.rows} resolution: ${totalCells} cells, feature in cell ${cellWithFeature}`);
      }
    });

    test("should maintain feature distribution consistency across resolutions", () => {
      // Create features in different areas
      const features: AnyProcessedFeature[] = [
        {
          title: "Northwest Feature",
          dataset: "test", url: "http://test.com/1", recordType: "text", tags: [],
          startYear: 1900, endYear: 2000,
          geometry: { type: "Point", coordinates: { lon: 4.82, lat: 52.58 } }
        },
        {
          title: "Center Feature", 
          dataset: "test", url: "http://test.com/2", recordType: "text", tags: [],
          startYear: 1900, endYear: 2000,
          geometry: { type: "Point", coordinates: { lon: 4.95, lat: 52.45 } }
        },
        {
          title: "Southeast Feature",
          dataset: "test", url: "http://test.com/3", recordType: "text", tags: [],
          startYear: 1900, endYear: 2000, 
          geometry: { type: "Point", coordinates: { lon: 5.08, lat: 52.32 } }
        }
      ];

      // Test at different resolutions
      const resolutions = [
        { cols: 2, rows: 2, name: "low" },
        { cols: 4, rows: 4, name: "medium" },
        { cols: 8, rows: 8, name: "high" }
      ];

      for (const resolution of resolutions) {
        const dimensions: HeatmapDimensions = {
          colsAmount: resolution.cols,
          rowsAmount: resolution.rows,
          cellWidth: (5.1 - 4.8) / resolution.cols,
          cellHeight: (52.6 - 52.3) / resolution.rows,
          minLon: 4.8,
          maxLon: 5.1,
          minLat: 52.3,
          maxLat: 52.6
        };

        const accumulator = createHeatmapAccumulator(dimensions);
        
        // Process all features
        features.forEach(feature => processFeatureIntoCounts(feature, accumulator));
        
        const timeSlice = createTimeSlice(1900, 2000);
        const timeline = generateHeatmapTimelineFromAccumulator(accumulator, timeSlice);
        const heatmap = timeline[timeSlice.key]['text'].base;
        
        // Verify total features preserved
        const totalFeatures = heatmap.countarray.reduce((sum, count) => sum + count, 0);
        expect(totalFeatures).toBe(3);
        
        // Count non-empty cells
        const nonEmptyCells = heatmap.countarray.filter(count => count > 0).length;
        expect(nonEmptyCells).toBeGreaterThan(0);
        expect(nonEmptyCells).toBeLessThanOrEqual(3); // Can't have more non-empty cells than features
        
        console.log(`✅ ${resolution.name} res (${resolution.cols}x${resolution.rows}): ${totalFeatures} features in ${nonEmptyCells} cells`);
      }
    });

    test("should handle coordinate precision at different resolutions", () => {
      // Test coordinate that might cause precision issues
      const testCoordinate = { lon: 4.933333, lat: 52.466666 };
      
      const resolutions = [
        { cols: 3, rows: 3 },
        { cols: 6, rows: 6 },
        { cols: 10, rows: 10 },
        { cols: 20, rows: 20 }
      ];

      for (const resolution of resolutions) {
        const dimensions: HeatmapDimensions = {
          colsAmount: resolution.cols,
          rowsAmount: resolution.rows,
          cellWidth: (5.1 - 4.8) / resolution.cols,
          cellHeight: (52.6 - 52.3) / resolution.rows,
          minLon: 4.8,
          maxLon: 5.1,
          minLat: 52.3,
          maxLat: 52.6
        };

        const cellId = getCellIdForCoordinates(testCoordinate, dimensions);
        
        // Should always get a valid cell ID (coordinate is within bounds)
        expect(cellId).not.toBeNull();
        expect(cellId).toMatch(/^\d+_\d+$/);
        
        if (cellId) {
          const [row, col] = cellId.split('_').map(Number);
          expect(row).toBeGreaterThanOrEqual(0);
          expect(row).toBeLessThan(resolution.rows);
          expect(col).toBeGreaterThanOrEqual(0);
          expect(col).toBeLessThan(resolution.cols);
        }
        
        console.log(`✅ ${resolution.cols}x${resolution.rows}: (${testCoordinate.lon}, ${testCoordinate.lat}) -> ${cellId}`);
      }
    });

    test("should generate blueprints for different resolutions", () => {
      const resolutions = [
        { cols: 2, rows: 2 },
        { cols: 5, rows: 3 },  // Non-square
        { cols: 10, rows: 10 }
      ];

      for (const resolution of resolutions) {
        const dimensions: HeatmapDimensions = {
          colsAmount: resolution.cols,
          rowsAmount: resolution.rows,
          cellWidth: (5.1 - 4.8) / resolution.cols,
          cellHeight: (52.6 - 52.3) / resolution.rows,
          minLon: 4.8,
          maxLon: 5.1,
          minLat: 52.3,
          maxLat: 52.6
        };

        const blueprint = generateHeatmapBlueprint(dimensions);
        
        expect(blueprint.rows).toBe(resolution.rows);
        expect(blueprint.cols).toBe(resolution.cols);
        expect(blueprint.cells).toHaveLength(resolution.cols * resolution.rows);
        
        // Verify all cells have valid bounds (with floating point tolerance)
        blueprint.cells.forEach(cell => {
          expect(cell.bounds.minlon).toBeLessThan(cell.bounds.maxlon);
          expect(cell.bounds.minlat).toBeLessThan(cell.bounds.maxlat);
          expect(cell.bounds.minlon).toBeGreaterThanOrEqual(4.8);
          expect(cell.bounds.maxlon).toBeLessThanOrEqual(5.1 + 0.000001); // Add small tolerance for floating point precision
          expect(cell.bounds.minlat).toBeGreaterThanOrEqual(52.3);
          expect(cell.bounds.maxlat).toBeLessThanOrEqual(52.6 + 0.000001); // Add small tolerance for floating point precision
        });
        
        console.log(`✅ Blueprint ${resolution.cols}x${resolution.rows}: ${blueprint.cells.length} cells`);
      }
    });
  });
  describe("Integration Scenarios", () => {
    test("should demonstrate multi-TimeSlice workflow", () => {
      const periods = [
        { start: 1800, end: 1900 },
        { start: 1900, end: 2000 },
        { start: 2000, end: 2025 }
      ];
      
      const timeSlices = createTimeSlices(periods);
      const results: any = {};
      
      // Simulate processing different time periods
      for (const timeSlice of timeSlices) {
        const accumulator = createHeatmapAccumulator(testHeatmapDimensions);
        
        // Add features for this time period
        const feature: AnyProcessedFeature = {
          title: `Document from ${timeSlice.label}`,
          dataset: "test",
          url: "http://test.com",
          recordType: "text",
          tags: [],
          startYear: timeSlice.startYear,
          endYear: timeSlice.endYear,
          geometry: { type: "Point", coordinates: { lon: 4.85, lat: 52.35 } }
        };
        
        processFeatureIntoCounts(feature, accumulator);
        
        const timeline = generateHeatmapTimelineFromAccumulator(accumulator, timeSlice);
        results[timeSlice.key] = timeline[timeSlice.key];
      }
      
      // Verify we have all three periods
      expect(Object.keys(results)).toHaveLength(3);
      expect(results).toHaveProperty('1800_1900');
      expect(results).toHaveProperty('1900_2000');
      expect(results).toHaveProperty('2000_2025');
      
      // Each period should have text data
      for (const key of Object.keys(results)) {
        expect(results[key]['text'].base.countarray[0]).toBe(1);
      }
      
      console.log("✅ Multi-TimeSlice workflow completed successfully");
    });
  });
});

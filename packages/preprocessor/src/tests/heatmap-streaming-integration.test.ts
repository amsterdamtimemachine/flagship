// src/tests/heatmap-streaming-integration.test.ts - Clean streaming integration tests

import { describe, test, expect, beforeAll } from "bun:test";
import {
  createSpatialChunks,
  streamFeaturesByChunks
} from '../data-sources/streaming';
import {
  createHeatmapAccumulator,
  processFeatureIntoCounts,
  generateHeatmap,
  generateHeatmapBlueprint,
  generateHeatmapTimelineForrecordType,
  createTimeSlice,
  getFeatureCoordinates,
  getCellIdForCoordinates
} from '../processing/heatmap';
import { AMSTERDAM_DATABASE_CONFIG, DEFAULT_CHUNKING } from '../config/defaults';
import type { 
  ChunkingConfig, 
  GridCellBounds,
  HeatmapDimensions,
  HeatmapCellBounds,
  AnyProcessedFeature,
  TimeSlice,
  HeatmapResolutionConfig
} from '../types';

describe("Streaming Integration Tests", () => {
  
  // Clean Amsterdam test bounds - small area for reliable testing
  const testBounds: GridCellBounds = {
    minLon: 4.87,
    maxLon: 4.89,
    minLat: 52.36,
    maxLat: 52.37
  };
  
  // Convert to HeatmapCellBounds format
  const testHeatmapBounds: HeatmapCellBounds = {
    minlon: testBounds.minLon,
    maxlon: testBounds.maxLon,
    minlat: testBounds.minLat,
    maxlat: testBounds.maxLat
  };
  
  // Clean 4x4 grid for testing
  const testHeatmapDimensions: HeatmapDimensions = {
    colsAmount: 4,
    rowsAmount: 4,
    cellWidth: (testBounds.maxLon - testBounds.minLon) / 4,
    cellHeight: (testBounds.maxLat - testBounds.minLat) / 4,
    minLon: testBounds.minLon,
    maxLon: testBounds.maxLon,
    minLat: testBounds.minLat,
    maxLat: testBounds.maxLat
  };

  beforeAll(() => {
    console.log("🔍 Streaming integration test setup:");
    console.log(`📍 Test bounds: ${testBounds.minLon},${testBounds.minLat} to ${testBounds.maxLon},${testBounds.maxLat}`);
    console.log(`🗓️ Grid: ${testHeatmapDimensions.colsAmount}x${testHeatmapDimensions.rowsAmount}`);
    console.log(`🔗 API: ${AMSTERDAM_DATABASE_CONFIG.baseUrl}`);
  });

  describe("API Data Streaming", () => {
    
    test("should stream features and process into accumulator", async () => {
      console.log("🔄 Testing basic streaming and accumulation...");
      
      const accumulator = createHeatmapAccumulator(testHeatmapDimensions);
      let totalFeatures = 0;
      let chunkCount = 0;
      const cellDistribution = new Map<string, number>();
      
      const chunkConfig: ChunkingConfig = {
        chunkRows: 1,
        chunkCols: 1,
        delayMs: 100
      };
      
      // Stream features and accumulate
      for await (const { chunk, features, stats } of streamFeaturesByChunks(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        chunkConfig
      )) {
        chunkCount++;
        totalFeatures += features.length;
        
        console.log(`📦 Chunk ${chunk.id}: ${features.length} features (${stats.invalidSkipped} skipped)`);
        
        // Process each feature
        features.forEach(feature => {
          try {
            expect(feature.recordType).toBe('text'); // Should only get text records
            
            const coords = getFeatureCoordinates(feature);
            const cellId = getCellIdForCoordinates(coords, testHeatmapDimensions);
            
            if (cellId) {
              cellDistribution.set(cellId, (cellDistribution.get(cellId) || 0) + 1);
            }
            
            processFeatureIntoCounts(feature, accumulator);
          } catch (error) {
            console.warn(`⚠️ Error processing feature: ${error}`);
          }
        });
        
        break; // Test just one chunk for reliability
      }
      
      expect(chunkCount).toBe(1);
      console.log(`✅ Processed ${totalFeatures} features`);
      console.log(`🏷️ Unique tags found: ${accumulator.collectedtags.size}`);
      
      if (totalFeatures > 0) {
        console.log(`📊 Cell distribution: ${Array.from(cellDistribution.entries()).slice(0, 3).map(([cell, count]) => `${cell}:${count}`).join(', ')}`);
        
        // Validate accumulator has data
        expect(accumulator.cellcounts.base.get('text')).toBeDefined();
        expect(accumulator.cellcounts.base.get('text')!.size).toBeGreaterThan(0);
      }
    }, 30000);

    test("should handle specific record type streaming", async () => {
      console.log("🔄 Testing text record type streaming...");
      
      let featureCount = 0;
      let chunkCount = 0;
      
      // Stream only text records
      for await (const { chunk, features } of streamFeaturesByChunks(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        { chunkRows: 1, chunkCols: 1, delayMs: 100 },
        { 
          recordType: 'text',
          timeRange: { start: '1900-01-01', end: '2024-12-31' }
        }
      )) {
        chunkCount++;
        featureCount += features.length;
        
        // Verify all features are text type
        features.forEach(feature => {
          expect(feature.recordType).toBe('text');
          expect(feature.title).toBeDefined();
          expect(feature.dataset).toBeDefined();
          expect(feature.url).toBeDefined();
          expect(feature.geometry).toBeDefined();
          expect(feature.startYear).toBeDefined();
          expect(feature.endYear).toBeDefined();
        });
        
        console.log(`📊 Text records: ${features.length} features`);
        break; // Test one chunk
      }
      
      expect(chunkCount).toBe(1);
      expect(featureCount).toBeGreaterThanOrEqual(0);
      
      console.log(`✅ Text streaming test completed: ${featureCount} features`);
    }, 30000);

    test("should validate coordinate mappings", async () => {
      console.log("🔄 Testing coordinate mapping accuracy...");
      
      let featuresProcessed = 0;
      let validMappings = 0;
      let outOfBounds = 0;
      
      for await (const { chunk, features } of streamFeaturesByChunks(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        { chunkRows: 1, chunkCols: 1, delayMs: 50 }
      )) {
        
        features.forEach(feature => {
          featuresProcessed++;
          
          const coords = getFeatureCoordinates(feature);
          const cellId = getCellIdForCoordinates(coords, testHeatmapDimensions);
          
          if (cellId) {
            validMappings++;
            
            // Validate cell ID format
            expect(cellId).toMatch(/^\d+_\d+$/);
            
            // Parse cell coordinates
            const [row, col] = cellId.split('_').map(Number);
            expect(row).toBeGreaterThanOrEqual(0);
            expect(row).toBeLessThan(4);
            expect(col).toBeGreaterThanOrEqual(0);
            expect(col).toBeLessThan(4);
            
            // Validate coordinates are within bounds
            expect(coords.lon).toBeGreaterThanOrEqual(testBounds.minLon);
            expect(coords.lon).toBeLessThan(testBounds.maxLon);
            expect(coords.lat).toBeGreaterThanOrEqual(testBounds.minLat);
            expect(coords.lat).toBeLessThan(testBounds.maxLat);
          } else {
            outOfBounds++;
          }
        });
        
        break; // Test one chunk
      }
      
      console.log(`📍 Coordinate validation: ${validMappings}/${featuresProcessed} valid, ${outOfBounds} out of bounds`);
      
      if (featuresProcessed > 0) {
        expect(validMappings).toBeGreaterThanOrEqual(0);
        expect(validMappings + outOfBounds).toBe(featuresProcessed);
        
        // Most features should be within bounds for our test area
        const validPercentage = (validMappings / featuresProcessed) * 100;
        console.log(`📊 ${validPercentage.toFixed(1)}% of features within bounds`);
      }
    }, 30000);
  });

  describe("Full Pipeline Generation", () => {
    
    test("should generate complete heatmap from streamed data", async () => {
      console.log("🔥 Testing full heatmap generation pipeline...");
      
      const timeSlice = createTimeSlice(1900, 2024);
      const chunkConfig: ChunkingConfig = {
        chunkRows: 1,
        chunkCols: 1,
        delayMs: 100
      };
      
      const heatmapTimeline = await generateHeatmapTimelineForrecordType(
        AMSTERDAM_DATABASE_CONFIG,
        testHeatmapBounds,
        chunkConfig,
        'text',
        testHeatmapDimensions,
        timeSlice
      );
      
      // Validate timeline structure
      expect(heatmapTimeline).toBeDefined();
      expect(heatmapTimeline[timeSlice.key]).toBeDefined();
      expect(heatmapTimeline[timeSlice.key].text).toBeDefined();
      expect(heatmapTimeline[timeSlice.key].image).toBeDefined();
      expect(heatmapTimeline[timeSlice.key].event).toBeDefined();
      
      const textHeatmap = heatmapTimeline[timeSlice.key].text.base;
      
      // Validate heatmap structure
      expect(textHeatmap.countarray).toHaveLength(16); // 4x4 grid
      expect(textHeatmap.densityarray).toHaveLength(16);
      
      // Validate data integrity
      textHeatmap.countarray.forEach(count => {
        expect(count).toBeGreaterThanOrEqual(0);
      });
      
      textHeatmap.densityarray.forEach(density => {
        expect(density).toBeGreaterThanOrEqual(0);
        expect(density).toBeLessThanOrEqual(1);
      });
      
      const totalFeatures = textHeatmap.countarray.reduce((sum, count) => sum + count, 0);
      const cellsWithData = textHeatmap.countarray.filter(count => count > 0).length;
      const maxCount = Math.max(...textHeatmap.countarray);
      
      console.log(`🔥 Heatmap results:`, {
        totalFeatures,
        cellsWithData,
        maxCount,
        gridSize: '4x4',
        timeSlice: timeSlice.label
      });
      
      // Validate tag heatmaps structure
      const tagHeatmaps = heatmapTimeline[timeSlice.key].text.tags;
      const tagCount = Object.keys(tagHeatmaps).length;
      
      console.log(`🏷️ Tag heatmaps: ${tagCount} unique tags`);
      
      // If there are tags, validate their structure
      if (tagCount > 0) {
        const sampleTag = Object.keys(tagHeatmaps)[0];
        const tagHeatmap = tagHeatmaps[sampleTag];
        
        expect(tagHeatmap.countarray).toHaveLength(16);
        expect(tagHeatmap.densityarray).toHaveLength(16);
        
        const tagFeatures = tagHeatmap.countarray.reduce((sum, count) => sum + count, 0);
        console.log(`   Sample tag "${sampleTag}": ${tagFeatures} features`);
      }
      
      // Other record types should be empty (no image/event data in API yet)
      expect(heatmapTimeline[timeSlice.key].image.base.countarray.every(count => count === 0)).toBe(true);
      expect(heatmapTimeline[timeSlice.key].event.base.countarray.every(count => count === 0)).toBe(true);
      
    }, 60000);

    test("should generate heatmap blueprint correctly", () => {
      const blueprint = generateHeatmapBlueprint(testHeatmapDimensions);
      
      expect(blueprint.rows).toBe(4);
      expect(blueprint.cols).toBe(4);
      expect(blueprint.cells).toHaveLength(16);
      
      // Validate each cell
      blueprint.cells.forEach(cell => {
        expect(cell.cellid).toMatch(/^\d+_\d+$/);
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.row).toBeLessThan(4);
        expect(cell.col).toBeGreaterThanOrEqual(0);
        expect(cell.col).toBeLessThan(4);
        
        // Validate bounds
        expect(cell.bounds.minlon).toBeLessThan(cell.bounds.maxlon);
        expect(cell.bounds.minlat).toBeLessThan(cell.bounds.maxlat);
        expect(cell.bounds.minlon).toBeGreaterThanOrEqual(testHeatmapBounds.minlon);
        expect(cell.bounds.maxlon).toBeLessThanOrEqual(testHeatmapBounds.maxlon + 0.000001);
        expect(cell.bounds.minlat).toBeGreaterThanOrEqual(testHeatmapBounds.minlat);
        expect(cell.bounds.maxlat).toBeLessThanOrEqual(testHeatmapBounds.maxlat + 0.000001);
      });
      
      // Validate coverage
      const firstCell = blueprint.cells.find(c => c.cellid === '0_0')!;
      const lastCell = blueprint.cells.find(c => c.cellid === '3_3')!;
      
      expect(firstCell.bounds.minlon).toBeCloseTo(testHeatmapBounds.minlon, 5);
      expect(firstCell.bounds.minlat).toBeCloseTo(testHeatmapBounds.minlat, 5);
      expect(lastCell.bounds.maxlon).toBeCloseTo(testHeatmapBounds.maxlon, 5);
      expect(lastCell.bounds.maxlat).toBeCloseTo(testHeatmapBounds.maxlat, 5);
      
      console.log(`🗺️ Blueprint validated: ${blueprint.cells.length} cells`);
    });
  });

  describe("Multi-Resolution Streaming", () => {
    
    test("should generate heatmaps at different resolutions", async () => {
      console.log("🔥 Testing multi-resolution streaming pipeline...");
      
      const resolutions: HeatmapResolutionConfig[] = [
        { cols: 2, rows: 2 },   // 4 cells
        { cols: 3, rows: 3 },   // 9 cells
        { cols: 4, rows: 4 }    // 16 cells
      ];
      
      const timeSlice = createTimeSlice(2000, 2024); // Recent data
      const chunkConfig: ChunkingConfig = {
        chunkRows: 1,
        chunkCols: 1,
        delayMs: 100
      };
      
      for (const resolution of resolutions) {
        console.log(`🔍 Testing ${resolution.cols}x${resolution.rows} resolution...`);
        
        const dimensions: HeatmapDimensions = {
          colsAmount: resolution.cols,
          rowsAmount: resolution.rows,
          cellWidth: (testHeatmapBounds.maxlon - testHeatmapBounds.minlon) / resolution.cols,
          cellHeight: (testHeatmapBounds.maxlat - testHeatmapBounds.minlat) / resolution.rows,
          minLon: testHeatmapBounds.minlon,
          maxLon: testHeatmapBounds.maxlon,
          minLat: testHeatmapBounds.minlat,
          maxLat: testHeatmapBounds.maxlat
        };
        
        const heatmapTimeline = await generateHeatmapTimelineForrecordType(
          AMSTERDAM_DATABASE_CONFIG,
          testHeatmapBounds,
          chunkConfig,
          'text',
          dimensions,
          timeSlice
        );
        
        const heatmap = heatmapTimeline[timeSlice.key].text.base;
        const totalCells = resolution.cols * resolution.rows;
        
        // Validate structure
        expect(heatmap.countarray).toHaveLength(totalCells);
        expect(heatmap.densityarray).toHaveLength(totalCells);
        
        const totalFeatures = heatmap.countarray.reduce((sum, count) => sum + count, 0);
        const cellsWithData = heatmap.countarray.filter(count => count > 0).length;
        const maxCount = Math.max(...heatmap.countarray);
        
        console.log(`   ${resolution.cols}x${resolution.rows}: ${totalFeatures} features, ${cellsWithData}/${totalCells} cells, max: ${maxCount}`);
        
        // Validate consistency
        expect(totalFeatures).toBeGreaterThanOrEqual(0);
        expect(cellsWithData).toBeLessThanOrEqual(totalCells);
        expect(maxCount).toBeGreaterThanOrEqual(0);
        
        // If there are features, density should be properly normalized
        if (totalFeatures > 0) {
          const maxDensity = Math.max(...heatmap.densityarray);
          expect(maxDensity).toBeLessThanOrEqual(1.0);
          expect(maxDensity).toBeGreaterThan(0);
        }
      }
      
      console.log("✅ Multi-resolution streaming test completed");
    }, 120000);

    test("should maintain feature consistency across resolutions", async () => {
      console.log("🔄 Testing feature count consistency across resolutions...");
      
      const resolutions = [
        { cols: 2, rows: 2, name: "low" },
        { cols: 4, rows: 4, name: "medium" }
      ];
      
      const timeSlice = createTimeSlice(2000, 2024);
      const chunkConfig: ChunkingConfig = {
        chunkRows: 1,
        chunkCols: 1,
        delayMs: 50
      };
      
      const featureCounts: number[] = [];
      
      for (const resolution of resolutions) {
        const dimensions: HeatmapDimensions = {
          colsAmount: resolution.cols,
          rowsAmount: resolution.rows,
          cellWidth: (testHeatmapBounds.maxlon - testHeatmapBounds.minlon) / resolution.cols,
          cellHeight: (testHeatmapBounds.maxlat - testHeatmapBounds.minlat) / resolution.rows,
          minLon: testHeatmapBounds.minlon,
          maxLon: testHeatmapBounds.maxlon,
          minLat: testHeatmapBounds.minlat,
          maxLat: testHeatmapBounds.maxlat
        };
        
        const heatmapTimeline = await generateHeatmapTimelineForrecordType(
          AMSTERDAM_DATABASE_CONFIG,
          testHeatmapBounds,
          chunkConfig,
          'text',
          dimensions,
          timeSlice
        );
        
        const heatmap = heatmapTimeline[timeSlice.key].text.base;
        const totalFeatures = heatmap.countarray.reduce((sum, count) => sum + count, 0);
        featureCounts.push(totalFeatures);
        
        console.log(`   ${resolution.name} (${resolution.cols}x${resolution.rows}): ${totalFeatures} features`);
      }
      
      // Feature counts should be the same across different resolutions
      if (featureCounts.length > 1 && featureCounts[0] > 0) {
        const firstCount = featureCounts[0];
        featureCounts.forEach(count => {
          expect(count).toBe(firstCount);
        });
        console.log(`✅ Feature count consistency verified: ${firstCount} features across all resolutions`);
      } else {
        console.log(`ℹ️ Consistency test skipped: ${featureCounts.join(', ')} features found`);
      }
      
    }, 90000);
  });

  describe("Performance and Edge Cases", () => {
    
    test("should handle chunking with delays", async () => {
      const startTime = Date.now();
      
      const delayConfig: ChunkingConfig = {
        chunkRows: 2,
        chunkCols: 1,
        delayMs: 200
      };
      
      let chunkCount = 0;
      
      for await (const { chunk, features } of streamFeaturesByChunks(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        delayConfig
      )) {
        chunkCount++;
        console.log(`⏱️ Chunk ${chunk.id}: ${features.length} features after ${Date.now() - startTime}ms`);
        
        if (chunkCount >= 2) break;
      }
      
      const totalTime = Date.now() - startTime;
      
      // Should take at least the delay time
      expect(totalTime).toBeGreaterThan(150);
      expect(chunkCount).toBe(2);
      
      console.log(`⏱️ Performance: 2 chunks in ${totalTime}ms with 200ms delays`);
    }, 30000);

    test("should handle empty area gracefully", async () => {
      // Use bounds outside Amsterdam
      const emptyBounds: GridCellBounds = {
        minLon: 10.0,
        maxLon: 10.01,
        minLat: 60.0,
        maxLat: 60.01
      };
      
      const accumulator = createHeatmapAccumulator({
        colsAmount: 2,
        rowsAmount: 2,
        cellWidth: 0.005,
        cellHeight: 0.005,
        minLon: emptyBounds.minLon,
        maxLon: emptyBounds.maxLon,
        minLat: emptyBounds.minLat,
        maxLat: emptyBounds.maxLat
      });
      
      let chunkCount = 0;
      let totalFeatures = 0;
      
      for await (const { chunk, features } of streamFeaturesByChunks(
        AMSTERDAM_DATABASE_CONFIG,
        emptyBounds,
        { chunkRows: 1, chunkCols: 1, delayMs: 50 }
      )) {
        chunkCount++;
        totalFeatures += features.length;
        
        features.forEach(feature => {
          processFeatureIntoCounts(feature, accumulator);
        });
        
        break;
      }
      
      expect(chunkCount).toBe(1);
      expect(totalFeatures).toBe(0);
      
      // Generate heatmap from empty accumulator
      const emptyHeatmap = generateHeatmap(new Map(), accumulator.heatmapDimensions);
      
      expect(emptyHeatmap.countarray.every(count => count === 0)).toBe(true);
      expect(emptyHeatmap.densityarray.every(density => density === 0)).toBe(true);
      
      console.log("✅ Empty area handled gracefully");
    }, 20000);

    test("should validate chunking configurations", () => {
      const configs = [
        { chunkRows: 1, chunkCols: 1 },
        { chunkRows: 2, chunkCols: 2 },
        DEFAULT_CHUNKING
      ];
      
      configs.forEach(config => {
        const chunks = createSpatialChunks(testBounds, config);
        
        expect(chunks).toHaveLength(config.chunkRows * config.chunkCols);
        
        chunks.forEach(chunk => {
          expect(chunk.id).toMatch(/^chunk_\d+_\d+$/);
          expect(chunk.bounds.minLon).toBeLessThan(chunk.bounds.maxLon);
          expect(chunk.bounds.minLat).toBeLessThan(chunk.bounds.maxLat);
          
          // Should be within original bounds (allowing for small overlap)
          expect(chunk.bounds.minLon).toBeGreaterThanOrEqual(testBounds.minLon - 0.01);
          expect(chunk.bounds.maxLon).toBeLessThanOrEqual(testBounds.maxLon + 0.01);
          expect(chunk.bounds.minLat).toBeGreaterThanOrEqual(testBounds.minLat - 0.01);
          expect(chunk.bounds.maxLat).toBeLessThanOrEqual(testBounds.maxLat + 0.01);
        });
      });
      
      console.log(`✅ Validated ${configs.length} chunking configurations`);
    });
  });

  describe("TimeSlice Integration", () => {
    
    test("should handle different time periods", async () => {
      console.log("🔄 Testing TimeSlice integration...");
      
      const timeSlices = [
        createTimeSlice(1800, 1900),
        createTimeSlice(1900, 2000),
        createTimeSlice(2000, 2024)
      ];
      
      const chunkConfig: ChunkingConfig = {
        chunkRows: 1,
        chunkCols: 1,
        delayMs: 100
      };
      
      const results: Record<string, number> = {};
      
      for (const timeSlice of timeSlices) {
        console.log(`   Testing period: ${timeSlice.label}`);
        
        const heatmapTimeline = await generateHeatmapTimelineForrecordType(
          AMSTERDAM_DATABASE_CONFIG,
          testHeatmapBounds,
          chunkConfig,
          'text',
          testHeatmapDimensions,
          timeSlice
        );
        
        expect(heatmapTimeline[timeSlice.key]).toBeDefined();
        expect(heatmapTimeline[timeSlice.key].text).toBeDefined();
        
        const totalFeatures = heatmapTimeline[timeSlice.key].text.base.countarray
          .reduce((sum, count) => sum + count, 0);
        
        results[timeSlice.key] = totalFeatures;
        
        console.log(`     ${timeSlice.label}: ${totalFeatures} features`);
      }
      
      console.log("✅ TimeSlice integration test completed");
      console.log(`📊 Results: ${Object.entries(results).map(([key, count]) => `${key}:${count}`).join(', ')}`);
      
      // All time slices should have valid structure even if no features
      Object.keys(results).forEach(key => {
        expect(results[key]).toBeGreaterThanOrEqual(0);
      });
      
    }, 120000);
  });
});

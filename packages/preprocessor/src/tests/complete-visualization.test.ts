// src/tests/complete-visualization.test.ts - Test complete visualization binary with heatmaps and histograms

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { unlink } from "node:fs/promises";
import {
  generateHeatmapsForMultipleTimeSlices,
  generateHeatmapBlueprint,
  createTimeSlices,
} from '../processing/heatmap';
import {
  generateHistogramsForMultiplePeriods,
} from '../processing/histogram';

import type {
  TimeSlice,
  HistogramStack,
  VisualizationData,
  HeatmapDimensions,
  RecordType
} from '@atm/shared/types';

import {
  createVisualizationBinary,
  createVisualizationData,
  generateVisualizationStats,
  VisualizationBinaryReader,
} from '../serialization/visualization';

import { AMSTERDAM_DATABASE_CONFIG } from '../config/defaults';

describe("Visualization Binary (Heatmaps + Histograms)", () => {
  
  // Test configuration
  const testBounds = {
    minLon: 4.85,
    minLat: 52.35,
    maxLon: 4.9,
    maxLat: 52.37
  };

  const testGridDimensions: GridDimensions = {
    colsAmount: 4,
    rowsAmount: 4,
    cellWidth: (testBounds.maxLon - testBounds.minLon) / 4,
    cellHeight: (testBounds.maxLat - testBounds.minLat) / 4,
    minLon: testBounds.minLon,
    maxLon: testBounds.maxLon,
    minLat: testBounds.minLat,
    maxLat: testBounds.maxLat
  };

  // ✅ Create test TimeSlices
  const testTimeSlices: TimeSlice[] = createTimeSlices([
    { start: 1900, end: 1950 },
    { start: 1950, end: 2000 }
  ]);

  const recordtypes: RecordType[] = ['text', 'image'];
  const chunkConfig = {
    chunkRows: 2,
    chunkCols: 2,
    overlap: 0.001,
    delayMs: 300
  };

  const testBinaryPath = './test-complete-visualization.bin';

  // Clean up test file after all tests
  afterAll(async () => {
    try {
      await unlink(testBinaryPath);
    } catch (error) {
      // File might not exist, that's fine
    }
  });

  test("should generate and save complete visualization data (heatmaps + histograms)", async () => {
    console.log("🧪 Starting complete visualization generation and binary serialization...");
    
    try {
      // ✅ Step 1: Generate heatmaps for multiple TimeSlices and recordtypes
      console.log("🔥 Generating heatmaps for multiple TimeSlices...");
      console.log(`📅 TimeSlices: ${testTimeSlices.map(ts => ts.label).join(', ')}`);
      console.log(`📊 Recordtypes: ${recordtypes.join(', ')}`);
      
      const heatmapStack = await generateHeatmapsForMultipleTimeSlices(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        chunkConfig,
        recordtypes,
        testGridDimensions,
        testTimeSlices
      );

      // ✅ Step 2: Generate histograms for the same TimeSlices and recordtypes
      console.log("📈 Generating histograms for multiple TimeSlices...");
      
      const histogramStack = await generateHistogramsForMultiplePeriods(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        chunkConfig,
        recordtypes,
        testTimeSlices
      );

      // ✅ Step 3: Create unified visualization data
      console.log("🔗 Creating unified visualization data...");
      const visualizationData = createVisualizationData([heatmapStack], [histogramStack]);
      
      // Verify data structure
      expect(visualizationData.heatmaps).toBeDefined();
      expect(visualizationData.histograms).toBeDefined();
      
      // Check that we have data for our TimeSlices
      for (const timeSlice of testTimeSlices) {
        expect(visualizationData.heatmaps).toHaveProperty(timeSlice.key);
        expect(visualizationData.histograms).toHaveProperty(timeSlice.key);
        
        // Check recordtypes exist
        for (const recordtype of recordtypes) {
          expect(visualizationData.heatmaps[timeSlice.key]).toHaveProperty(recordtype);
          expect(visualizationData.histograms![timeSlice.key]).toHaveProperty(recordtype);
        }
      }

      // ✅ Step 4: Generate blueprint and statistics
      const blueprint = generateHeatmapBlueprint(testGridDimensions);
      const stats = generateVisualizationStats(
        visualizationData.heatmaps, 
        visualizationData.histograms, 
        testTimeSlices
      );

      console.log(`📊 Generated stats: ${stats.totalFeatures} total features across ${stats.timeSliceCount} time slices`);
      console.log(`📋 Features per recordtype: ${JSON.stringify(stats.featuresPerRecordtype)}`);

      // ✅ Step 5: Save visualization binary
      console.log("💾 Saving visualization binary...");
      await createVisualizationBinary(
        testBinaryPath,
        visualizationData.heatmaps,
        visualizationData.histograms,
        testGridDimensions,
        blueprint,
        testTimeSlices,
        recordtypes,
        [], // No tags in current API
        stats
      );

      // ✅ Step 6: Verify file exists and has reasonable size
      const file = Bun.file(testBinaryPath);
      const exists = await file.exists();
      expect(exists).toBe(true);

      const fileSize = file.size;
      expect(fileSize).toBeGreaterThan(0);
      console.log(`📁 Complete binary file size: ${fileSize} bytes`);

      console.log("✅ Complete visualization generation and serialization successful");

    } catch (error) {
      console.error("❌ Complete visualization generation failed:", error);
      throw error;
    }
  }, 90000); // Longer timeout for multiple data types

  test("should load and verify complete binary metadata", async () => {
    console.log("🔍 Loading and verifying complete binary metadata...");

    try {
      const reader = new VisualizationBinaryReader(testBinaryPath);
      const metadata = await reader.readMetadata();

      console.log("📝 Metadata loaded successfully");

      // Verify enhanced metadata structure
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('timestamp');
      expect(metadata).toHaveProperty('gridDimensions');
      expect(metadata).toHaveProperty('heatmapBlueprint');
      expect(metadata).toHaveProperty('timeSlices');
      expect(metadata).toHaveProperty('timeRange');
      expect(metadata).toHaveProperty('recordtypes');
      expect(metadata).toHaveProperty('tags');
      expect(metadata).toHaveProperty('sections');
      expect(metadata).toHaveProperty('stats');

      // ✅ Verify version indicates histogram support
      expect(metadata.version).toBe('2.0.0');

      // ✅ Verify TimeSlices are preserved
      expect(metadata.timeSlices).toHaveLength(testTimeSlices.length);
      for (let i = 0; i < testTimeSlices.length; i++) {
        const original = testTimeSlices[i];
        const loaded = metadata.timeSlices[i];
        
        expect(loaded.key).toBe(original.key);
        expect(loaded.label).toBe(original.label);
        expect(loaded.startYear).toBe(original.startYear);
        expect(loaded.endYear).toBe(original.endYear);
        expect(loaded.durationYears).toBe(original.durationYears);
      }

      // ✅ Verify both sections exist
      expect(metadata.sections).toHaveProperty('heatmaps');
      expect(metadata.sections).toHaveProperty('histograms');
      expect(metadata.sections.heatmaps.offset).toBe(0);
      expect(metadata.sections.heatmaps.length).toBeGreaterThan(0);
      expect(metadata.sections.histograms!.offset).toBeGreaterThan(0);
      expect(metadata.sections.histograms!.length).toBeGreaterThan(0);

      // ✅ Verify statistics
      expect(metadata.stats).toBeDefined();
      expect(metadata.stats!.totalFeatures).toBeGreaterThanOrEqual(0);
      expect(metadata.stats!.timeSliceCount).toBe(testTimeSlices.length);
      expect(metadata.stats!.gridCellCount).toBe(testGridDimensions.colsAmount * testGridDimensions.rowsAmount);

      console.log("✅ Complete binary metadata verification successful");
      console.log(`   - Version: ${metadata.version}`);
      console.log(`   - TimeSlices: ${metadata.timeSlices.length}`);
      console.log(`   - Recordtypes: ${metadata.recordtypes.join(', ')}`);
      console.log(`   - Heatmaps section: ${metadata.sections.heatmaps.length} bytes`);
      console.log(`   - Histograms section: ${metadata.sections.histograms!.length} bytes`);
      console.log(`   - Total features: ${metadata.stats!.totalFeatures}`);

    } catch (error) {
      console.error("❌ Complete binary metadata verification failed:", error);
      throw error;
    }
  }, 10000);

  test("should load and verify heatmaps data from complete binary", async () => {
    console.log("🔥 Loading and verifying heatmaps data from complete binary...");

    try {
      const reader = new VisualizationBinaryReader(testBinaryPath);
      const heatmapsData = await reader.readHeatmaps();

      console.log("🔥 Heatmaps data loaded successfully");

      // ✅ Verify TimeSlice-based structure
      for (const timeSlice of testTimeSlices) {
        expect(heatmapsData).toHaveProperty(timeSlice.key);
        
        const timeSliceData = heatmapsData[timeSlice.key];
        
        // Verify recordtypes
        for (const recordtype of recordtypes) {
          expect(timeSliceData).toHaveProperty(recordtype);
          expect(timeSliceData[recordtype]).toHaveProperty('base');
          expect(timeSliceData[recordtype]).toHaveProperty('tags');
          
          // Verify heatmap arrays
          const baseHeatmap = timeSliceData[recordtype].base;
          expect(baseHeatmap).toHaveProperty('countArray');
          expect(baseHeatmap).toHaveProperty('densityArray');
          
          const expectedLength = testGridDimensions.colsAmount * testGridDimensions.rowsAmount;
          expect(baseHeatmap.countArray).toHaveLength(expectedLength);
          expect(baseHeatmap.densityArray).toHaveLength(expectedLength);
          
          // Verify density normalization
          const densityArray = Array.from(baseHeatmap.densityArray);
          for (const density of densityArray) {
            expect(density).toBeGreaterThanOrEqual(0);
            expect(density).toBeLessThanOrEqual(1);
            expect(density).not.toBeNaN();
          }
        }
      }

      console.log("✅ Heatmaps data verification successful");
      console.log(`   - TimeSlices verified: ${testTimeSlices.length}`);
      console.log(`   - Recordtypes verified: ${recordtypes.length}`);
      console.log(`   - Grid cells per heatmap: ${testGridDimensions.colsAmount * testGridDimensions.rowsAmount}`);

    } catch (error) {
      console.error("❌ Heatmaps data verification failed:", error);
      throw error;
    }
  }, 10000);

  test("should load and verify histograms data from complete binary", async () => {
    console.log("📈 Loading and verifying histograms data from complete binary...");

    try {
      const reader = new VisualizationBinaryReader(testBinaryPath);
      const histogramsData = await reader.readHistograms();

      expect(histogramsData).not.toBeNull();
      console.log("📈 Histograms data loaded successfully");

      // ✅ Verify TimeSlice-based structure
      for (const timeSlice of testTimeSlices) {
        expect(histogramsData!).toHaveProperty(timeSlice.key);
        
        const timeSliceData = histogramsData![timeSlice.key];
        
        // Verify recordtypes
        for (const recordtype of recordtypes) {
          expect(timeSliceData).toHaveProperty(recordtype);
          expect(timeSliceData[recordtype]).toHaveProperty('base');
          expect(timeSliceData[recordtype]).toHaveProperty('tags');
          
          // Verify histogram bin structure
          const baseBin = timeSliceData[recordtype].base;
          expect(baseBin).toHaveProperty('period');
          expect(baseBin).toHaveProperty('count');
          expect(baseBin).toHaveProperty('contentCounts');
          expect(baseBin).toHaveProperty('tagCounts');
          
          // Verify period matches TimeSlice key
          expect(baseBin.period).toBe(timeSlice.key);
          
          // Verify count structure
          expect(baseBin.contentCounts).toHaveProperty('text');
          expect(baseBin.contentCounts).toHaveProperty('image');
          expect(baseBin.contentCounts).toHaveProperty('event');
          
          // Verify counts are non-negative
          expect(baseBin.count).toBeGreaterThanOrEqual(0);
          expect(baseBin.contentCounts.text).toBeGreaterThanOrEqual(0);
          expect(baseBin.contentCounts.image).toBeGreaterThanOrEqual(0);
          expect(baseBin.contentCounts.event).toBeGreaterThanOrEqual(0);
        }
      }

      console.log("✅ Histograms data verification successful");
      console.log(`   - TimeSlices verified: ${testTimeSlices.length}`);
      console.log(`   - Recordtypes verified: ${recordtypes.length}`);

      // Show some actual data
      const firstTimeSlice = testTimeSlices[0];
      const textBin = histogramsData![firstTimeSlice.key]['text'].base;
      console.log(`   - Example: ${firstTimeSlice.label} text features: ${textBin.contentCounts.text}`);

    } catch (error) {
      console.error("❌ Histograms data verification failed:", error);
      throw error;
    }
  }, 10000);

  test("should load complete visualization data and verify consistency", async () => {
    console.log("🔗 Loading complete visualization data and verifying consistency...");

    try {
      const reader = new VisualizationBinaryReader(testBinaryPath);
      const completeData = await reader.readComplete();

      console.log("🔗 Complete data loaded successfully");

      // ✅ Verify structure
      expect(completeData).toHaveProperty('heatmaps');
      expect(completeData).toHaveProperty('histograms');
      expect(completeData).toHaveProperty('metadata');
      expect(completeData.histograms).not.toBeNull();

      // ✅ Verify consistency between heatmaps and histograms
      const timeSliceKeys = Object.keys(completeData.heatmaps);
      const histogramKeys = Object.keys(completeData.histograms!);
      
      expect(timeSliceKeys.sort()).toEqual(histogramKeys.sort());
      console.log(`   - Consistent TimeSlice keys: ${timeSliceKeys.join(', ')}`);

      // ✅ Verify feature count consistency
      for (const timeSliceKey of timeSliceKeys) {
        const heatmapData = completeData.heatmaps[timeSliceKey];
        const histogramData = completeData.histograms![timeSliceKey];
        
        for (const recordtype of recordtypes) {
          // Sum features from heatmap
          const heatmapCounts = Array.from(heatmapData[recordtype].base.countArray);
          const heatmapTotal = heatmapCounts.reduce((sum, count) => sum + count, 0);
          
          // Get features from histogram
          const histogramTotal = histogramData[recordtype].base.contentCounts[recordtype];
          
          // Should be consistent (heatmaps count spatially, histograms count temporally)
          expect(heatmapTotal).toBe(histogramTotal);
          
          console.log(`   - ${timeSliceKey} ${recordtype}: ${heatmapTotal} features (consistent)`);
        }
      }

      // ✅ Verify metadata consistency
      expect(completeData.metadata.timeSlices).toHaveLength(timeSliceKeys.length);
      expect(completeData.metadata.recordtypes).toEqual(expect.arrayContaining(recordtypes));

      console.log("✅ Complete visualization data consistency verified");
      console.log(`   - Data types: heatmaps + histograms`);
      console.log(`   - TimeSlices: ${timeSliceKeys.length}`);
      console.log(`   - Recordtypes: ${recordtypes.length}`);
      console.log(`   - Feature count consistency: ✓`);

    } catch (error) {
      console.error("❌ Complete visualization data consistency verification failed:", error);
      throw error;
    }
  }, 10000);

  test("should demonstrate complete binary usage patterns", async () => {
    console.log("💡 Demonstrating complete binary usage patterns...");

    try {
      const reader = new VisualizationBinaryReader(testBinaryPath);
      
      // ✅ Pattern 1: Load metadata only for quick info
      const metadata = await reader.readMetadata();
      console.log("📋 Metadata-only access:");
      console.log(`   - Version: ${metadata.version}`);
      console.log(`   - TimeSlices: ${metadata.timeSlices.length}`);
      console.log(`   - Has histograms: ${metadata.sections.histograms ? 'Yes' : 'No'}`);
      console.log(`   - Total features: ${metadata.stats?.totalFeatures || 'Unknown'}`);

      // ✅ Pattern 2: Load specific data type
      const heatmaps = await reader.readHeatmaps();
      const histograms = await reader.readHistograms();
      console.log("🎯 Selective data access:");
      console.log(`   - Heatmaps loaded: ${Object.keys(heatmaps).length} time slices`);
      console.log(`   - Histograms loaded: ${histograms ? Object.keys(histograms).length : 0} time slices`);

      // ✅ Pattern 3: Load everything
      const complete = await reader.readComplete();
      console.log("🔗 Complete data access:");
      console.log(`   - All data loaded in one call`);
      console.log(`   - Metadata included automatically`);

      // ✅ Pattern 4: Access specific time slice and recordtype
      const firstTimeSlice = testTimeSlices[0];
      const textHeatmap = heatmaps[firstTimeSlice.key]['text'].base;
      const textHistogram = histograms![firstTimeSlice.key]['text'].base;
      
      console.log("🎪 Specific data access:");
      console.log(`   - TimeSlice: ${firstTimeSlice.label}`);
      console.log(`   - Heatmap access: heatmaps["${firstTimeSlice.key}"]["text"].base`);
      console.log(`   - Histogram access: histograms["${firstTimeSlice.key}"]["text"].base`);
      console.log(`   - Spatial cells: ${textHeatmap.countArray.length}`);
      console.log(`   - Temporal count: ${textHistogram.count}`);

      // ✅ Pattern 5: TimeSlice-aware processing
      console.log("⏰ TimeSlice-aware processing:");
      for (const timeSlice of metadata.timeSlices) {
        const duration = timeSlice.durationYears;
        const label = timeSlice.label;
        const key = timeSlice.key;
        
        console.log(`   - ${label}: ${duration} years (key: ${key})`);
        
        // Access data using TimeSlice information
        if (heatmaps[key] && histograms![key]) {
          const textFeatures = histograms![key]['text'].base.contentCounts.text;
          const featuresPerYear = Math.round(textFeatures / duration);
          console.log(`     Text features: ${textFeatures} (${featuresPerYear}/year average)`);
        }
      }

      console.log("✅ Complete binary usage patterns demonstrated");

    } catch (error) {
      console.error("❌ Usage patterns demonstration failed:", error);
      throw error;
    }
  }, 10000);
});

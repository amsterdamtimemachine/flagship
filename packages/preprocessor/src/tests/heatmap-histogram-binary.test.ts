// src/tests/heatmap-histogram-binary.test.ts - Complete test for heatmap resolutions and histogram binary serialization

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { unlink } from "node:fs/promises";
import {
  generateHeatmapResolutions,
  generateHeatmapBlueprint,
  createTimeSlices,
  createTimeSlice
} from '../processing/heatmap';
import {
  generateFilteredHistogram
} from '../processing/histogram';

import type {
  TimeSlice,
  HeatmapResolutions,
  Histograms,
  HeatmapDimensions,
  HeatmapResolutionConfig,
  RecordType,
  HeatmapCellBounds
} from '@atm/shared/types';

import {
  generateVisualizationBinaryFromResolutions,
  generateDefaultHistograms,
  createVisualizationBinary,
  generateVisualizationStats,
  VisualizationBinaryReader,
  createVisualizationData
} from '../serialization/visualization';

import { AMSTERDAM_DATABASE_CONFIG } from '../config/defaults';

describe("Complete Heatmap & Histogram Binary Workflow", () => {
  
  // Test configuration
  const testBounds: HeatmapCellBounds = {
    minLon: 4.85,
    minLat: 52.35,
    maxLon: 4.9,
    maxLat: 52.37
  };

  const testResolutions: HeatmapResolutionConfig[] = [
    { cols: 8, rows: 8 },    // 64 cells
    { cols: 16, rows: 16 }   // 256 cells
  ];

  // Create test TimeSlices
  const testTimeSlices: TimeSlice[] = createTimeSlices([
    { start: 1900, end: 1950 },
    { start: 1950, end: 2000 }
  ]);

  const recordTypes: RecordType[] = ['text', 'image'];
  const testTags = ['politics', 'culture', 'economics'];
  
  const chunkConfig = {
    chunkRows: 2,
    chunkCols: 2,
    overlap: 0.001,
    delayMs: 300
  };

  const testBinaryPath = './test-heatmap-histogram-complete.bin';

  // Generated data (will be populated in tests)
  let heatmapResolutions: HeatmapResolutions;
  let histograms: Histograms;
  let heatmapDimensions: HeatmapDimensions;

  // Clean up test file after all tests
  afterAll(async () => {
    try {
      await unlink(testBinaryPath);
    } catch (error) {
      // File might not exist, that's fine
    }
  });

  test("should generate HeatmapResolutions with multiple resolutions", async () => {
    console.log("🔥 Generating HeatmapResolutions...");
    console.log(`   Resolutions: ${testResolutions.map(r => `${r.cols}x${r.rows}`).join(', ')}`);
    console.log(`   TimeSlices: ${testTimeSlices.map(ts => ts.label).join(', ')}`);
    console.log(`   RecordTypes: ${recordTypes.join(', ')}`);
    
    heatmapResolutions = await generateHeatmapResolutions(
      AMSTERDAM_DATABASE_CONFIG,
      testBounds,
      chunkConfig,
      recordTypes,
      testResolutions,
      testTimeSlices
    );

    // Verify structure
    expect(heatmapResolutions).toBeDefined();
    expect(typeof heatmapResolutions).toBe('object');
    
    // Check that we have all resolutions
    const resolutionKeys = Object.keys(heatmapResolutions);
    expect(resolutionKeys).toHaveLength(testResolutions.length);
    
    for (const resConfig of testResolutions) {
      const resKey = `${resConfig.cols}x${resConfig.rows}`;
      expect(heatmapResolutions).toHaveProperty(resKey);
      
      const heatmapTimeline = heatmapResolutions[resKey];
      
      // Check that we have all time slices
      for (const timeSlice of testTimeSlices) {
        expect(heatmapTimeline).toHaveProperty(timeSlice.key);
        
        const timeSliceData = heatmapTimeline[timeSlice.key];
        
        // Check that we have all record types
        for (const recordType of recordTypes) {
          expect(timeSliceData).toHaveProperty(recordType);
          expect(timeSliceData[recordType]).toHaveProperty('base');
          expect(timeSliceData[recordType]).toHaveProperty('tags');
          
          // Verify heatmap structure
          const baseHeatmap = timeSliceData[recordType].base;
          expect(baseHeatmap).toHaveProperty('countarray');
          expect(baseHeatmap).toHaveProperty('densityarray');
          
          const expectedCellCount = resConfig.cols * resConfig.rows;
          expect(baseHeatmap.countarray).toHaveLength(expectedCellCount);
          expect(baseHeatmap.densityarray).toHaveLength(expectedCellCount);
        }
      }
    }

    // Store dimensions for later tests
    heatmapDimensions = {
      colsAmount: testResolutions[0].cols,
      rowsAmount: testResolutions[0].rows,
      cellWidth: (testBounds.maxLon - testBounds.minLon) / testResolutions[0].cols,
      cellHeight: (testBounds.maxLat - testBounds.minLat) / testResolutions[0].rows,
      minLon: testBounds.minLon,
      maxLon: testBounds.maxLon,
      minLat: testBounds.minLat,
      maxLat: testBounds.maxLat
    };

    console.log("✅ HeatmapResolutions generated successfully");
    console.log(`   Generated ${resolutionKeys.length} resolutions: ${resolutionKeys.join(', ')}`);
  }, 90000);

  test("should generate structured Histograms", async () => {
    console.log("📊 Generating structured Histograms...");
    
    histograms = await generateDefaultHistograms(
      AMSTERDAM_DATABASE_CONFIG,
      testBounds,
      chunkConfig,
      testTimeSlices,
      recordTypes,
      testTags
    );

    // Verify structure
    expect(histograms).toBeDefined();
    expect(typeof histograms).toBe('object');
    
    // Check that we have all record types
    for (const recordType of recordTypes) {
      expect(histograms).toHaveProperty(recordType);
      expect(histograms[recordType]).toHaveProperty('base');
      expect(histograms[recordType]).toHaveProperty('tags');
      
      // Verify base histogram
      const baseHistogram = histograms[recordType].base;
      expect(baseHistogram).toHaveProperty('bins');
      expect(baseHistogram).toHaveProperty('recordType');
      expect(baseHistogram).toHaveProperty('maxCount');
      expect(baseHistogram).toHaveProperty('totalFeatures');
      expect(baseHistogram.recordType).toBe(recordType);
      
      // Check that bins span all time periods
      expect(baseHistogram.bins).toHaveLength(testTimeSlices.length);
      
      for (let i = 0; i < testTimeSlices.length; i++) {
        const bin = baseHistogram.bins[i];
        const expectedTimeSlice = testTimeSlices[i];
        
        expect(bin).toHaveProperty('timeSlice');
        expect(bin).toHaveProperty('count');
        expect(bin.timeSlice.key).toBe(expectedTimeSlice.key);
        expect(bin.timeSlice.label).toBe(expectedTimeSlice.label);
        expect(bin.count).toBeGreaterThanOrEqual(0);
      }
      
      // Verify tag histograms
      const tagHistograms = histograms[recordType].tags;
      expect(typeof tagHistograms).toBe('object');
      
      // Should have some tag histograms (up to 5 per recordType)
      const tagKeys = Object.keys(tagHistograms);
      expect(tagKeys.length).toBeGreaterThanOrEqual(0);
      expect(tagKeys.length).toBeLessThanOrEqual(testTags.length);
      
      for (const [tag, tagHistogram] of Object.entries(tagHistograms)) {
        expect(testTags).toContain(tag);
        expect(tagHistogram).toHaveProperty('bins');
        expect(tagHistogram).toHaveProperty('recordType');
        expect(tagHistogram).toHaveProperty('tags');
        expect(tagHistogram.recordType).toBe(recordType);
        expect(tagHistogram.tags).toContain(tag);
      }
    }

    console.log("✅ Structured Histograms generated successfully");
    console.log(`   Generated histograms for ${recordTypes.length} recordTypes`);
    
    for (const recordType of recordTypes) {
      const tagCount = Object.keys(histograms[recordType].tags).length;
      console.log(`   ${recordType}: base + ${tagCount} tag histograms`);
    }
  }, 60000);

  test("should create visualization binary from generated data", async () => {
    console.log("💾 Creating visualization binary...");
    
    // Generate blueprint
    const heatmapBlueprint = generateHeatmapBlueprint(heatmapDimensions);
    
    // Generate stats
    const stats = generateVisualizationStats(heatmapResolutions, histograms, testTimeSlices);
    
    // Create binary
    await createVisualizationBinary(
      testBinaryPath,
      heatmapResolutions,
      histograms,
      heatmapDimensions,
      heatmapBlueprint,
      testTimeSlices,
      recordTypes,
      testResolutions,
      testTags,
      stats
    );

    // Verify file exists and has reasonable size
    const file = Bun.file(testBinaryPath);
    const exists = await file.exists();
    expect(exists).toBe(true);

    const fileSize = file.size;
    expect(fileSize).toBeGreaterThan(0);
    
    console.log("✅ Visualization binary created successfully");
    console.log(`   File size: ${fileSize} bytes`);
    console.log(`   Stats: ${stats?.totalFeatures} total features`);
  }, 30000);

  test("should load and verify metadata from binary", async () => {
    console.log("📋 Loading and verifying metadata...");

    const reader = new VisualizationBinaryReader(testBinaryPath);
    const metadata = await reader.readMetadata();

    // Verify metadata structure
    expect(metadata).toHaveProperty('version');
    expect(metadata).toHaveProperty('timestamp');
    expect(metadata).toHaveProperty('heatmapDimensions');
    expect(metadata).toHaveProperty('heatmapBlueprint');
    expect(metadata).toHaveProperty('timeSlices');
    expect(metadata).toHaveProperty('resolutions');
    expect(metadata).toHaveProperty('recordTypes');
    expect(metadata).toHaveProperty('tags');
    expect(metadata).toHaveProperty('sections');
    expect(metadata).toHaveProperty('stats');

    // Verify version indicates multi-resolution support
    expect(metadata.version).toBe('2.0.0');

    // Verify TimeSlices preservation
    expect(metadata.timeSlices).toHaveLength(testTimeSlices.length);
    for (let i = 0; i < testTimeSlices.length; i++) {
      const original = testTimeSlices[i];
      const loaded = metadata.timeSlices[i];
      
      expect(loaded.key).toBe(original.key);
      expect(loaded.label).toBe(original.label);
      expect(loaded.startYear).toBe(original.startYear);
      expect(loaded.endYear).toBe(original.endYear);
    }

    // Verify resolutions
    expect(metadata.resolutions).toHaveLength(testResolutions.length);
    for (let i = 0; i < testResolutions.length; i++) {
      const original = testResolutions[i];
      const loaded = metadata.resolutions[i];
      
      expect(loaded.cols).toBe(original.cols);
      expect(loaded.rows).toBe(original.rows);
    }

    // Verify recordTypes and tags
    expect(metadata.recordTypes).toEqual(expect.arrayContaining(recordTypes));
    expect(metadata.tags).toEqual(expect.arrayContaining(testTags));

    // Verify sections exist
    expect(metadata.sections.heatmaps.length).toBeGreaterThan(0);
    expect(metadata.sections.histograms.length).toBeGreaterThan(0);

    // Verify stats
    expect(metadata.stats?.totalFeatures).toBeGreaterThanOrEqual(0);
    expect(metadata.stats?.resolutionCount).toBe(testResolutions.length);

    console.log("✅ Metadata verification successful");
    console.log(`   Version: ${metadata.version}`);
    console.log(`   Resolutions: ${metadata.resolutions.length}`);
    console.log(`   TimeSlices: ${metadata.timeSlices.length}`);
    console.log(`   RecordTypes: ${metadata.recordTypes.join(', ')}`);
  }, 10000);

  test("should load and verify HeatmapResolutions from binary", async () => {
    console.log("🔥 Loading HeatmapResolutions from binary...");

    const reader = new VisualizationBinaryReader(testBinaryPath);
    const loadedHeatmaps = await reader.readHeatmaps();

    // Verify structure matches original
    expect(loadedHeatmaps).toBeDefined();
    
    const resolutionKeys = Object.keys(loadedHeatmaps);
    expect(resolutionKeys).toHaveLength(testResolutions.length);
    
    // Compare with original data
    for (const resolutionKey of resolutionKeys) {
      expect(heatmapResolutions).toHaveProperty(resolutionKey);
      
      const originalTimeline = heatmapResolutions[resolutionKey];
      const loadedTimeline = loadedHeatmaps[resolutionKey];
      
      for (const timeSlice of testTimeSlices) {
        expect(loadedTimeline).toHaveProperty(timeSlice.key);
        
        const originalTimeSliceData = originalTimeline[timeSlice.key];
        const loadedTimeSliceData = loadedTimeline[timeSlice.key];
        
        for (const recordType of recordTypes) {
          expect(loadedTimeSliceData).toHaveProperty(recordType);
          
          const originalBase = originalTimeSliceData[recordType].base;
          const loadedBase = loadedTimeSliceData[recordType].base;
          
          // Verify array content preservation
          expect(loadedBase.countarray).toEqual(originalBase.countarray);
          expect(loadedBase.densityarray).toEqual(originalBase.densityarray);
        }
      }
    }

    console.log("✅ HeatmapResolutions verification successful");
    console.log(`   Loaded ${resolutionKeys.length} resolutions: ${resolutionKeys.join(', ')}`);
  }, 10000);

  test("should load and verify structured Histograms from binary", async () => {
    console.log("📊 Loading structured Histograms from binary...");

    const reader = new VisualizationBinaryReader(testBinaryPath);
    const loadedHistograms = await reader.readHistograms();

    // Verify structure matches original
    expect(loadedHistograms).toBeDefined();
    
    // Check recordType structure
    for (const recordType of recordTypes) {
      expect(loadedHistograms).toHaveProperty(recordType);
      expect(loadedHistograms[recordType]).toHaveProperty('base');
      expect(loadedHistograms[recordType]).toHaveProperty('tags');
      
      // Verify base histogram
      const originalBase = histograms[recordType].base;
      const loadedBase = loadedHistograms[recordType].base;
      
      expect(loadedBase.recordType).toBe(originalBase.recordType);
      expect(loadedBase.maxCount).toBe(originalBase.maxCount);
      expect(loadedBase.totalFeatures).toBe(originalBase.totalFeatures);
      expect(loadedBase.bins).toHaveLength(originalBase.bins.length);
      
      // Verify bins content
      for (let i = 0; i < originalBase.bins.length; i++) {
        const originalBin = originalBase.bins[i];
        const loadedBin = loadedBase.bins[i];
        
        expect(loadedBin.count).toBe(originalBin.count);
        expect(loadedBin.timeSlice.key).toBe(originalBin.timeSlice.key);
      }
      
      // Verify tag histograms
      const originalTags = histograms[recordType].tags;
      const loadedTags = loadedHistograms[recordType].tags;
      
      for (const [tag, originalTagHistogram] of Object.entries(originalTags)) {
        expect(loadedTags).toHaveProperty(tag);
        
        const loadedTagHistogram = loadedTags[tag];
        expect(loadedTagHistogram.recordType).toBe(originalTagHistogram.recordType);
        expect(loadedTagHistogram.tags).toEqual(originalTagHistogram.tags);
        expect(loadedTagHistogram.bins).toHaveLength(originalTagHistogram.bins.length);
      }
    }

    console.log("✅ Structured Histograms verification successful");
    console.log(`   Loaded histograms for ${recordTypes.length} recordTypes`);
    
    // Test access patterns
    console.log("🎯 Testing access patterns:");
    console.log(`   histograms["text"].base.totalFeatures = ${loadedHistograms["text"].base.totalFeatures}`);
    
    const textTagKeys = Object.keys(loadedHistograms["text"].tags);
    if (textTagKeys.length > 0) {
      const firstTag = textTagKeys[0];
      console.log(`   histograms["text"].tags["${firstTag}"].totalFeatures = ${loadedHistograms["text"].tags[firstTag].totalFeatures}`);
    }
  }, 10000);

  test("should load complete visualization data and verify consistency", async () => {
    console.log("🔗 Loading complete visualization data...");

    const reader = new VisualizationBinaryReader(testBinaryPath);
    const completeData = await reader.readComplete();

    // Verify structure
    expect(completeData).toHaveProperty('heatmaps');
    expect(completeData).toHaveProperty('histograms');
    expect(completeData).toHaveProperty('metadata');

    // Verify consistency between components
    const heatmaps = completeData.heatmaps;
    const histograms = completeData.histograms;
    const metadata = completeData.metadata;

    // Check resolution consistency
    const heatmapResolutionKeys = Object.keys(heatmaps);
    expect(heatmapResolutionKeys).toHaveLength(metadata.resolutions.length);

    // Check recordType consistency
    for (const recordType of recordTypes) {
      expect(histograms).toHaveProperty(recordType);
      
      // Check that heatmaps contain this recordType in all resolutions/timeSlices
      for (const resolutionKey of heatmapResolutionKeys) {
        const timeline = heatmaps[resolutionKey];
        
        for (const timeSlice of testTimeSlices) {
          expect(timeline[timeSlice.key]).toHaveProperty(recordType);
        }
      }
    }

    // Test direct access patterns
    console.log("🎯 Testing direct access patterns:");
    
    // Heatmap access
    const firstResolution = heatmapResolutionKeys[0];
    const firstTimeSlice = testTimeSlices[0];
    const firstRecordType = recordTypes[0];
    
    const heatmapAccess = heatmaps[firstResolution][firstTimeSlice.key][firstRecordType].base;
    console.log(`   heatmaps["${firstResolution}"]["${firstTimeSlice.key}"]["${firstRecordType}"].base.countarray.length = ${heatmapAccess.countarray.length}`);
    
    // Histogram access
    const histogramAccess = histograms[firstRecordType].base;
    console.log(`   histograms["${firstRecordType}"].base.totalFeatures = ${histogramAccess.totalFeatures}`);
    console.log(`   histograms["${firstRecordType}"].base.bins.length = ${histogramAccess.bins.length}`);

    console.log("✅ Complete visualization data verification successful");
  }, 10000);

  test("should demonstrate usage patterns for queries", async () => {
    console.log("💡 Demonstrating query patterns...");

    const reader = new VisualizationBinaryReader(testBinaryPath);
    const data = await reader.readComplete();

    console.log("📊 Histogram Queries:");
    
    // Query: Get histogram for recordType "text"
    const textHistogram = data.histograms["text"].base;
    console.log(`   recordType "text": ${textHistogram.totalFeatures} features across ${textHistogram.bins.length} periods`);
    
    // Query: Get histogram for recordType "text" + tag (if exists)
    const textTags = Object.keys(data.histograms["text"].tags);
    if (textTags.length > 0) {
      const firstTag = textTags[0];
      const textTagHistogram = data.histograms["text"].tags[firstTag];
      console.log(`   recordType "text" + tag "${firstTag}": ${textTagHistogram.totalFeatures} features`);
    }

    console.log("🔥 Heatmap Queries:");
    
    // Query: Get heatmap for recordType "text" at resolution "8x8" for period "1900_1950"
    const resolutions = Object.keys(data.heatmaps);
    const lowRes = resolutions.find(r => r.includes('8x8')) || resolutions[0];
    const timeSliceKey = testTimeSlices[0].key;
    
    const heatmap = data.heatmaps[lowRes][timeSliceKey]["text"].base;
    console.log(`   recordType "text" at ${lowRes} for ${timeSliceKey}: ${heatmap.countarray.length} cells`);
    
    // Query: Get heatmap for recordType "text" + tag at specific resolution
    const heatmapTimeline = data.heatmaps[lowRes][timeSliceKey]["text"];
    const heatmapTagKeys = Object.keys(heatmapTimeline.tags);
    if (heatmapTagKeys.length > 0) {
      const tagHeatmap = heatmapTimeline.tags[heatmapTagKeys[0]];
      console.log(`   recordType "text" + tag "${heatmapTagKeys[0]}" at ${lowRes}: ${tagHeatmap.countarray.length} cells`);
    }

    console.log("⚡ Performance Benefits:");
    console.log("   - Direct object access (no array filtering)");
    console.log("   - Memory efficient structured loading");
    console.log("   - Parallel heatmap/histogram access patterns");
    console.log("   - Multi-resolution spatial data + temporal timelines");

    console.log("✅ Query patterns demonstration complete");
  }, 5000);
});

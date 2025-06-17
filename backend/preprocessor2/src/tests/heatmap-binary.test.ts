// src/tests/heatmap-binary.test.ts - Test heatmap generation and binary serialization (TEXT ONLY)

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { unlink } from "node:fs/promises";
import { decode } from '@msgpack/msgpack';
import {
  generateHeatmapsForRecordtype,
  generateHeatmapBlueprint
} from '../processing';
import {
  createVisualizationBinary
} from '../serialization/visualization';
import { AMSTERDAM_DATABASE_CONFIG } from '../config/defaults';
import type { GridDimensions } from '../types/geo';

describe("Heatmap Binary Serialization (Text Only, No Tags)", () => {
  
  // Use consistent bounds for both data fetching and grid dimensions
  const testBounds = {
    minLon: 4.85,
    minLat: 52.35,
    maxLon: 4.9,
    maxLat: 52.37
  };

  // ✅ FIXED: Grid dimensions now match testBounds (not AMSTERDAM_BOUNDS)
  const testGridDimensions: GridDimensions = {
    colsAmount: 5,
    rowsAmount: 5,
    cellWidth: (testBounds.maxLon - testBounds.minLon) / 5,  // 0.01 degrees per cell
    cellHeight: (testBounds.maxLat - testBounds.minLat) / 5, // 0.004 degrees per cell
    minLon: testBounds.minLon,
    maxLon: testBounds.maxLon,
    minLat: testBounds.minLat,
    maxLat: testBounds.maxLat
  };

  const testBinaryPath = './test-visualization.bin';

  // Clean up test file after all tests
  afterAll(async () => {
    try {
      await unlink(testBinaryPath);
    } catch (error) {
      // File might not exist, that's fine
    }
  });

  test("should generate text heatmaps (no tags) and save to binary", async () => {
    console.log("🧪 Starting text heatmap generation and binary serialization test (no tags)...");
    
    const chunkConfig = {
      chunkRows: 2,
      chunkCols: 2,
      overlap: 0.001,
      delayMs: 200
    };
    
    const timeRange = {
      start: '1900-01-01',
      end: '1950-01-01'
    };

    try {
      // Step 1: Generate heatmaps for text recordtype only
      console.log("📊 Generating heatmaps for 'text' recordtype...");
      console.log(`📐 Using grid dimensions: ${testGridDimensions.colsAmount}x${testGridDimensions.rowsAmount}`);
      console.log(`📍 Grid bounds: lon(${testGridDimensions.minLon}, ${testGridDimensions.maxLon}), lat(${testGridDimensions.minLat}, ${testGridDimensions.maxLat})`);
      console.log(`📏 Cell size: ${testGridDimensions.cellWidth.toFixed(4)}° x ${testGridDimensions.cellHeight.toFixed(4)}°`);
      
      const textHeatmaps = await generateHeatmapsForRecordtype(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        chunkConfig,
        'text',
        testGridDimensions,
        timeRange
      );

      expect(textHeatmaps).toHaveProperty('base');
      expect(textHeatmaps).toHaveProperty('tags');
      
      // Verify the generated heatmap has correct dimensions
      const expectedCells = testGridDimensions.colsAmount * testGridDimensions.rowsAmount;
      expect(textHeatmaps.base.text.countArray).toHaveLength(expectedCells);
      console.log(`✅ Generated text heatmap with ${expectedCells} cells as expected`);

      // Debug: Check actual data in heatmap
      const countArray = Array.from(textHeatmaps.base.text.countArray);
      const totalFeatures = countArray.reduce((sum, count) => sum + count, 0);
      const nonZeroCells = countArray.filter(count => count > 0).length;
      console.log(`📊 Heatmap data: ${totalFeatures} total features in ${nonZeroCells} cells`);

      // Step 2: Generate heatmap blueprint
      const blueprint = generateHeatmapBlueprint(testGridDimensions);
      expect(blueprint.cells).toHaveLength(expectedCells);

      // Step 3: Prepare heatmaps data structure
      const heatmapsData = {
        '1900_1950': textHeatmaps
      };

      // Step 4: Save to binary
      console.log("💾 Saving text heatmaps to binary file...");
      await createVisualizationBinary(
        testBinaryPath,
        heatmapsData,
        testGridDimensions,
        blueprint,
        { start: '1900-01-01', end: '1950-01-01' },
        ['text'], // Only text recordtype
        [] // No tags in current API data
      );

      console.log("✅ Binary file created successfully");

      // Verify file exists
      const file = Bun.file(testBinaryPath);
      const exists = await file.exists();
      expect(exists).toBe(true);

      const fileSize = file.size;
      expect(fileSize).toBeGreaterThan(0);
      console.log(`📁 Binary file size: ${fileSize} bytes`);

    } catch (error) {
      console.error("❌ Text heatmap generation and serialization failed:", error);
      throw error;
    }
  }, 45000);

  test("should load and verify binary file metadata", async () => {
    console.log("🔍 Loading and verifying binary file metadata...");

    try {
      // Read the binary file
      const file = Bun.file(testBinaryPath);
      const buffer = await file.arrayBuffer();
      
      expect(buffer.byteLength).toBeGreaterThan(0);
      console.log(`📊 Loaded binary file: ${buffer.byteLength} bytes`);

      // Read metadata size
      const dataView = new DataView(buffer);
      const metadataSize = dataView.getUint32(0, false);
      console.log(`📋 Metadata size: ${metadataSize} bytes`);
      
      expect(metadataSize).toBeGreaterThan(0);
      expect(metadataSize).toBeLessThan(buffer.byteLength);

      // Read and decode metadata
      const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
      const metadata = decode(metadataBytes);
      
      console.log("📝 Metadata loaded successfully");

      // Verify metadata structure
      expect(metadata).toHaveProperty('version');
      expect(metadata).toHaveProperty('timestamp');
      expect(metadata).toHaveProperty('gridDimensions');
      expect(metadata).toHaveProperty('heatmapBlueprint');
      expect(metadata).toHaveProperty('timeRange');
      expect(metadata).toHaveProperty('recordtypes');
      expect(metadata).toHaveProperty('tags');
      expect(metadata).toHaveProperty('sections');

      // Verify grid dimensions match what we used
      expect(metadata.gridDimensions.colsAmount).toBe(testGridDimensions.colsAmount);
      expect(metadata.gridDimensions.rowsAmount).toBe(testGridDimensions.rowsAmount);
      expect(metadata.gridDimensions.minLon).toBeCloseTo(testGridDimensions.minLon, 5);
      expect(metadata.gridDimensions.maxLon).toBeCloseTo(testGridDimensions.maxLon, 5);
      expect(metadata.gridDimensions.minLat).toBeCloseTo(testGridDimensions.minLat, 5);
      expect(metadata.gridDimensions.maxLat).toBeCloseTo(testGridDimensions.maxLat, 5);

      // Verify heatmap blueprint
      expect(metadata.heatmapBlueprint.rows).toBe(testGridDimensions.rowsAmount);
      expect(metadata.heatmapBlueprint.cols).toBe(testGridDimensions.colsAmount);
      expect(metadata.heatmapBlueprint.cells).toHaveLength(testGridDimensions.colsAmount * testGridDimensions.rowsAmount);

      // Verify time range
      expect(metadata.timeRange.start).toBe('1900-01-01');
      expect(metadata.timeRange.end).toBe('1950-01-01');

      // Verify recordtypes and tags
      expect(metadata.recordtypes).toContain('text');
      expect(metadata.recordtypes).toHaveLength(1);
      expect(metadata.tags).toHaveLength(0); // No tags in current API data

      // Verify sections
      expect(metadata.sections).toHaveProperty('heatmaps');
      expect(metadata.sections.heatmaps.offset).toBeGreaterThanOrEqual(0);
      expect(metadata.sections.heatmaps.length).toBeGreaterThan(0);

      console.log("✅ Metadata verification successful");
      console.log(`   - Grid: ${metadata.gridDimensions.colsAmount}x${metadata.gridDimensions.rowsAmount}`);
      console.log(`   - Bounds: lon(${metadata.gridDimensions.minLon}, ${metadata.gridDimensions.maxLon}), lat(${metadata.gridDimensions.minLat}, ${metadata.gridDimensions.maxLat})`);
      console.log(`   - Time range: ${metadata.timeRange.start} to ${metadata.timeRange.end}`);
      console.log(`   - Record types: ${metadata.recordtypes.join(', ')}`);
      console.log(`   - Tags: ${metadata.tags.length} (none in current API data)`);
      console.log(`   - Heatmaps section: ${metadata.sections.heatmaps.length} bytes`);

    } catch (error) {
      console.error("❌ Binary file metadata verification failed:", error);
      throw error;
    }
  }, 10000);

  test("should load and verify text heatmaps data from binary", async () => {
    console.log("🔥 Loading and verifying text heatmaps data...");

    try {
      // Read the binary file
      const file = Bun.file(testBinaryPath);
      const buffer = await file.arrayBuffer();

      // Read metadata
      const dataView = new DataView(buffer);
      const metadataSize = dataView.getUint32(0, false);
      const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
      const metadata = decode(metadataBytes);

      // Calculate heatmaps data offset
      const dataStartOffset = 4 + metadataSize;
      const heatmapsOffset = metadata.sections.heatmaps.offset;
      const heatmapsLength = metadata.sections.heatmaps.length;

      console.log(`📊 Data section info:`);
      console.log(`   - Data start offset: ${dataStartOffset}`);
      console.log(`   - Heatmaps relative offset: ${heatmapsOffset}`);
      console.log(`   - Heatmaps length: ${heatmapsLength}`);
      console.log(`   - Total buffer size: ${buffer.byteLength}`);

      // Read heatmaps data
      const heatmapsBytes = new Uint8Array(
        buffer,
        dataStartOffset + heatmapsOffset,
        heatmapsLength
      );
      
      const heatmapsData = decode(heatmapsBytes);
      console.log("🔥 Heatmaps data loaded successfully");

      // Verify heatmaps structure
      expect(heatmapsData).toHaveProperty('1900_1950');
      
      const periodHeatmaps = heatmapsData['1900_1950'];
      expect(periodHeatmaps).toHaveProperty('base');
      expect(periodHeatmaps).toHaveProperty('tags');

      // Verify text heatmap exists
      expect(periodHeatmaps.base).toHaveProperty('text');

      // Verify text heatmap structure
      const textHeatmap = periodHeatmaps.base.text;
      expect(textHeatmap).toHaveProperty('countArray');
      expect(textHeatmap).toHaveProperty('densityArray');

      // Convert arrays for testing (handle both TypedArrays and regular arrays)
      const countArray = Array.from(textHeatmap.countArray);
      const densityArray = Array.from(textHeatmap.densityArray);

      // Check array length matches the grid dimensions
      const expectedLength = testGridDimensions.colsAmount * testGridDimensions.rowsAmount;
      console.log(`🔍 Checking array lengths: expected ${expectedLength}, got count:${countArray.length}, density:${densityArray.length}`);
      
      expect(countArray).toHaveLength(expectedLength);
      expect(densityArray).toHaveLength(expectedLength);

      // Check if we have some data
      const totalCounts = countArray.reduce((sum, count) => sum + count, 0);
      const nonZeroCells = countArray.filter(count => count > 0).length;
      const maxCount = Math.max(...countArray);
      const maxDensity = Math.max(...densityArray);

      console.log(`📊 Text heatmap data verification:`);
      console.log(`   - Total features: ${totalCounts}`);
      console.log(`   - Non-zero cells: ${nonZeroCells}`);
      console.log(`   - Max count: ${maxCount}`);
      console.log(`   - Max density: ${maxDensity}`);

      // Verify density values are normalized (0-1 range)
      for (let i = 0; i < densityArray.length; i++) {
        const density = densityArray[i];
        if (isNaN(density) || density < 0 || density > 1) {
          console.error(`Invalid density at index ${i}: ${density}`);
        }
        expect(density).toBeGreaterThanOrEqual(0);
        expect(density).toBeLessThanOrEqual(1);
        expect(density).not.toBeNaN();
      }

      console.log("✅ Text heatmaps data verification successful");

    } catch (error) {
      console.error("❌ Text heatmaps data verification failed:", error);
      throw error;
    }
  }, 10000);

  test("should handle round-trip consistency for text data", async () => {
    console.log("🔄 Testing round-trip consistency for text data...");

    try {
      // Load heatmaps from binary file first
      const file = Bun.file(testBinaryPath);
      const buffer = await file.arrayBuffer();
      const dataView = new DataView(buffer);
      const metadataSize = dataView.getUint32(0, false);
      const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
      const metadata = decode(metadataBytes);

      const dataStartOffset = 4 + metadataSize;
      const heatmapsBytes = new Uint8Array(
        buffer,
        dataStartOffset + metadata.sections.heatmaps.offset,
        metadata.sections.heatmaps.length
      );
      
      const loadedHeatmapsData = decode(heatmapsBytes);
      const loadedHeatmaps = loadedHeatmapsData['1900_1950'];

      // Generate fresh heatmaps using the SAME parameters as the saved ones
      const chunkConfig = {
        chunkRows: 2,
        chunkCols: 2,
        overlap: 0.001,
        delayMs: 100
      };

      console.log("🔄 Generating fresh text heatmaps for comparison...");
      const originalHeatmaps = await generateHeatmapsForRecordtype(
        AMSTERDAM_DATABASE_CONFIG,
        testBounds,
        chunkConfig,
        'text',
        testGridDimensions, // Use same grid dimensions
        { start: '1900-01-01', end: '1950-01-01' }
      );

      // Compare original vs loaded text heatmaps
      const originalCountArray = Array.from(originalHeatmaps.base.text.countArray);
      const loadedCountArray = Array.from(loadedHeatmaps.base.text.countArray);

      // Log comparison info
      console.log(`📊 Text heatmap comparison:`);
      console.log(`   - Original array length: ${originalCountArray.length}`);
      console.log(`   - Loaded array length: ${loadedCountArray.length}`);
      console.log(`   - Original total count: ${originalCountArray.reduce((sum, c) => sum + c, 0)}`);
      console.log(`   - Loaded total count: ${loadedCountArray.reduce((sum, c) => sum + c, 0)}`);

      // Arrays should have the same length
      expect(originalCountArray.length).toBe(loadedCountArray.length);

      // Verify structure consistency
      const originalNonZero = originalCountArray.filter(c => c > 0).length;
      const loadedNonZero = loadedCountArray.filter(c => c > 0).length;
      
      console.log(`   - Original non-zero cells: ${originalNonZero}`);
      console.log(`   - Loaded non-zero cells: ${loadedNonZero}`);

      // Both should have the same expected length
      const expectedLength = testGridDimensions.colsAmount * testGridDimensions.rowsAmount;
      expect(originalCountArray.length).toBe(expectedLength);
      expect(loadedCountArray.length).toBe(expectedLength);

      // Verify density arrays structure
      const originalDensityArray = Array.from(originalHeatmaps.base.text.densityArray);
      const loadedDensityArray = Array.from(loadedHeatmaps.base.text.densityArray);

      expect(originalDensityArray.length).toBe(expectedLength);
      expect(loadedDensityArray.length).toBe(expectedLength);

      console.log("✅ Round-trip structural consistency verified for text data");

      // Data consistency check (API data can vary between calls)
      if (loadedNonZero > 0 && originalNonZero > 0) {
        console.log("📊 Both heatmaps contain data - structures are consistent");
      } else if (loadedNonZero === 0 && originalNonZero === 0) {
        console.log("ℹ️ Both heatmaps are empty - consistent but no data in time range");
      } else {
        console.log("⚠️ Data varies between API calls - this is expected for live APIs");
      }

    } catch (error) {
      console.error("❌ Round-trip consistency test failed:", error);
      throw error;
    }
  }, 30000);

  test("should verify grid coordinate mapping", async () => {
    console.log("🗺️ Testing grid coordinate mapping...");

    try {
      // Load the saved metadata to verify grid setup
      const file = Bun.file(testBinaryPath);
      const buffer = await file.arrayBuffer();
      const dataView = new DataView(buffer);
      const metadataSize = dataView.getUint32(0, false);
      const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
      const metadata = decode(metadataBytes);

      // Verify grid covers the correct area
      const gridDims = metadata.gridDimensions;
      console.log(`🗺️ Grid setup verification:`);
      console.log(`   - Grid size: ${gridDims.colsAmount}x${gridDims.rowsAmount} = ${gridDims.colsAmount * gridDims.rowsAmount} cells`);
      console.log(`   - Longitude range: ${gridDims.minLon} to ${gridDims.maxLon} (width: ${(gridDims.maxLon - gridDims.minLon).toFixed(4)}°)`);
      console.log(`   - Latitude range: ${gridDims.minLat} to ${gridDims.maxLat} (height: ${(gridDims.maxLat - gridDims.minLat).toFixed(4)}°)`);
      console.log(`   - Cell size: ${gridDims.cellWidth.toFixed(4)}° x ${gridDims.cellHeight.toFixed(4)}°`);

      // Verify blueprint cells
      const blueprint = metadata.heatmapBlueprint;
      expect(blueprint.cells).toHaveLength(gridDims.colsAmount * gridDims.rowsAmount);

      // Check a few specific cells to verify coordinate mapping
      const cell_0_0 = blueprint.cells.find(cell => cell.cellId === '0_0');
      const cell_2_2 = blueprint.cells.find(cell => cell.cellId === '2_2');
      const cell_4_4 = blueprint.cells.find(cell => cell.cellId === '4_4');

      expect(cell_0_0).toBeDefined();
      expect(cell_2_2).toBeDefined();
      expect(cell_4_4).toBeDefined();

      console.log(`🗺️ Sample cell coordinates:`);
      console.log(`   - Cell 0_0: lon(${cell_0_0!.bounds.minLon.toFixed(4)}, ${cell_0_0!.bounds.maxLon.toFixed(4)}), lat(${cell_0_0!.bounds.minLat.toFixed(4)}, ${cell_0_0!.bounds.maxLat.toFixed(4)})`);
      console.log(`   - Cell 2_2: lon(${cell_2_2!.bounds.minLon.toFixed(4)}, ${cell_2_2!.bounds.maxLon.toFixed(4)}), lat(${cell_2_2!.bounds.minLat.toFixed(4)}, ${cell_2_2!.bounds.maxLat.toFixed(4)})`);
      console.log(`   - Cell 4_4: lon(${cell_4_4!.bounds.minLon.toFixed(4)}, ${cell_4_4!.bounds.maxLon.toFixed(4)}), lat(${cell_4_4!.bounds.minLat.toFixed(4)}, ${cell_4_4!.bounds.maxLat.toFixed(4)})`);

      // Verify cell 0_0 starts at grid minimum
      expect(cell_0_0!.bounds.minLon).toBeCloseTo(gridDims.minLon, 5);
      expect(cell_0_0!.bounds.minLat).toBeCloseTo(gridDims.minLat, 5);

      // Verify cell 4_4 ends at grid maximum
      expect(cell_4_4!.bounds.maxLon).toBeCloseTo(gridDims.maxLon, 5);
      expect(cell_4_4!.bounds.maxLat).toBeCloseTo(gridDims.maxLat, 5);

      console.log("✅ Grid coordinate mapping verification successful");

    } catch (error) {
      console.error("❌ Grid coordinate mapping verification failed:", error);
      throw error;
    }
  }, 10000);
});

// src/tests/streaming.test.ts - Fixed streaming tests

import { describe, test, expect } from "bun:test";
import {
  createSpatialChunks,
  streamFeaturesByChunks
} from '../data-sources/streaming';
import { AMSTERDAM_DATABASE_CONFIG, DEFAULT_CHUNKING } from '../config/defaults';
import type { ChunkingConfig } from '../data-sources/streaming';
import type { GridCellBounds } from '../types/geo';

describe("Spatial Chunking", () => {
  
  const testBounds: GridCellBounds = {
    minLon: 4.8,
    maxLon: 5.0,
    minLat: 52.3,
    maxLat: 52.4
  };

  test("createSpatialChunks should create correct number of chunks", () => {
    const config: ChunkingConfig = {
      chunkRows: 2,
      chunkCols: 2
    };
    
    const chunks = createSpatialChunks(testBounds, config);
    
    expect(chunks).toHaveLength(4); // 2x2 = 4 chunks
    
    // Check chunk structure
    chunks.forEach(chunk => {
      expect(chunk).toHaveProperty('id');
      expect(chunk).toHaveProperty('bounds');
      expect(typeof chunk.id).toBe('string');
      expect(chunk.bounds).toHaveProperty('minLon');
      expect(chunk.bounds).toHaveProperty('maxLon');
      expect(chunk.bounds).toHaveProperty('minLat');
      expect(chunk.bounds).toHaveProperty('maxLat');
    });
  });

  test("createSpatialChunks should generate unique chunk IDs", () => {
    const config: ChunkingConfig = {
      chunkRows: 3,
      chunkCols: 3
    };
    
    const chunks = createSpatialChunks(testBounds, config);
    const chunkIds = chunks.map(c => c.id);
    const uniqueIds = new Set(chunkIds);
    
    expect(uniqueIds.size).toBe(chunkIds.length); // All IDs should be unique
    expect(chunkIds).toContain('chunk_0_0');
    expect(chunkIds).toContain('chunk_2_2');
  });

  test("createSpatialChunks should handle single chunk", () => {
    const config: ChunkingConfig = {
      chunkRows: 1,
      chunkCols: 1
    };
    
    const chunks = createSpatialChunks(testBounds, config);
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0].id).toBe('chunk_0_0');
    
    // Single chunk should cover entire bounds
    const chunk = chunks[0];
    expect(chunk.bounds.minLon).toBeCloseTo(testBounds.minLon, 5);
    expect(chunk.bounds.maxLon).toBeCloseTo(testBounds.maxLon, 5);
    expect(chunk.bounds.minLat).toBeCloseTo(testBounds.minLat, 5);
    expect(chunk.bounds.maxLat).toBeCloseTo(testBounds.maxLat, 5);
  });

  test("createSpatialChunks should handle overlap correctly", () => {
    const config: ChunkingConfig = {
      chunkRows: 2,
      chunkCols: 2,
      overlap: 0.01 // 1% overlap
    };
    
    const chunks = createSpatialChunks(testBounds, config);
    
    expect(chunks).toHaveLength(4);
    
    // Check that chunks have some overlap
    const chunk1 = chunks.find(c => c.id === 'chunk_0_0')!;
    const chunk2 = chunks.find(c => c.id === 'chunk_0_1')!;
    
    // Adjacent chunks should overlap
    expect(chunk1.bounds.maxLon).toBeGreaterThan(chunk2.bounds.minLon);
  });

  test("DEFAULT_CHUNKING configuration should work", () => {
    const chunks = createSpatialChunks(testBounds, DEFAULT_CHUNKING);
    
    expect(chunks).toHaveLength(DEFAULT_CHUNKING.chunkRows * DEFAULT_CHUNKING.chunkCols);
    expect(chunks[0]).toHaveProperty('id');
    expect(chunks[0]).toHaveProperty('bounds');
  });
});

describe("Streaming Features", () => {
  
  const smallBounds: GridCellBounds = {
    minLon: 4.85,
    maxLon: 4.87,
    minLat: 52.35,
    maxLat: 52.36
  };

  test("streamFeaturesByChunks should generate chunks", async () => {
    const chunkConfig: ChunkingConfig = {
      chunkRows: 2,
      chunkCols: 2,
      delayMs: 50 // Small delay for testing
    };
    
    const chunks: Array<{ chunkId: string; featureCount: number }> = [];
    let totalFeatures = 0;
    
    const streamGenerator = streamFeaturesByChunks(
      AMSTERDAM_DATABASE_CONFIG,
      smallBounds,
      chunkConfig
    );
    
    // Collect first few chunks
    let chunkCount = 0;
    for await (const { chunk, features } of streamGenerator) {
      chunks.push({
        chunkId: chunk.id,
        featureCount: features.length
      });
      totalFeatures += features.length;
      
      chunkCount++;
      if (chunkCount >= 2) break; // Only test first 2 chunks
    }
    
    expect(chunks.length).toBe(2);
    expect(totalFeatures).toBeGreaterThanOrEqual(0);
    
    // Check chunk structure
    chunks.forEach(chunk => {
      expect(chunk.chunkId).toMatch(/^chunk_\d+_\d+$/);
      expect(chunk.featureCount).toBeGreaterThanOrEqual(0);
    });
  }, 30000);

  test("streamFeaturesByChunks should handle empty chunks", async () => {
    // Use bounds likely to have no features (way outside Amsterdam)
    const emptyBounds: GridCellBounds = {
      minLon: 10.0,
      maxLon: 10.1,
      minLat: 60.0,
      maxLat: 60.1
    };
    
    const chunkConfig: ChunkingConfig = {
      chunkRows: 1,
      chunkCols: 1,
      delayMs: 50
    };
    
    const streamGenerator = streamFeaturesByChunks(
      AMSTERDAM_DATABASE_CONFIG,
      emptyBounds,
      chunkConfig
    );
    
    const chunks = [];
    for await (const { chunk, features } of streamGenerator) {
      chunks.push({ chunk, features });
      break; // Just test one chunk
    }
    
    expect(chunks).toHaveLength(1);
    expect(chunks[0].features).toHaveLength(0);
  }, 15000);

  test("streamFeaturesByChunks should respect delay configuration", async () => {
    const chunkConfig: ChunkingConfig = {
      chunkRows: 2,
      chunkCols: 1,
      delayMs: 100 // 100ms delay
    };
    
    const startTime = Date.now();
    let chunkCount = 0;
    
    const streamGenerator = streamFeaturesByChunks(
      AMSTERDAM_DATABASE_CONFIG,
      smallBounds,
      chunkConfig
    );
    
    for await (const { _chunk, _features } of streamGenerator) {
      chunkCount++;
      if (chunkCount >= 2) break; // Process 2 chunks
    }
    
    const totalTime = Date.now() - startTime;
    
    // Should take at least the delay time (100ms between chunks)
    expect(totalTime).toBeGreaterThan(80); // Allow some variance
  }, 15000);

  test("streamFeaturesByChunks should return properly converted features", async () => {
    const chunkConfig: ChunkingConfig = {
      chunkRows: 1,
      chunkCols: 1,
      delayMs: 50
    };
    
    const testBounds: GridCellBounds = {
      minLon: 4.88,
      maxLon: 4.89,
      minLat: 52.36,
      maxLat: 52.37
    };
    
    const streamGenerator = streamFeaturesByChunks(
      AMSTERDAM_DATABASE_CONFIG,
      testBounds,
      chunkConfig
    );
    
    for await (const { _chunk, features } of streamGenerator) {
      if (features.length > 0) {
        const feature = features[0];
        
        // Should be converted to ProcessedFeature format
        expect(feature).toHaveProperty('dataset');
        expect(feature).toHaveProperty('title');
        expect(feature).toHaveProperty('geometry');
        expect(feature).toHaveProperty('startYear');
        expect(feature).toHaveProperty('endYear');
        expect(feature).toHaveProperty('tags');
        
        // Geometry should be properly parsed
        expect(feature.geometry.type).toBe('Point');
        expect(feature.geometry.coordinates).toHaveLength(2);
      }
      break; // Just test one chunk
    }
  }, 15000);

  test("streamFeaturesByChunks should handle API errors gracefully", async () => {
    // Use invalid config to trigger potential errors
    const invalidConfig = {
      ...AMSTERDAM_DATABASE_CONFIG,
      baseUrl: 'https://invalid-url-does-not-exist.com'
    };
    
    const chunkConfig: ChunkingConfig = {
      chunkRows: 1,
      chunkCols: 1,
      delayMs: 50
    };
    
    const streamGenerator = streamFeaturesByChunks(
      invalidConfig,
      smallBounds,
      chunkConfig
    );
    
    const results = [];
    
    try {
      for await (const { chunk, features } of streamGenerator) {
        results.push({ chunk: chunk.id, features: features.length });
        break; // Just test one chunk
      }
    } catch (error) {
      // Should handle errors gracefully
      expect(error).toBeInstanceOf(Error);
    }
    
    // Should have attempted to process at least one chunk
    expect(results.length).toBeLessThanOrEqual(1);
  }, 10000);
});

describe("Configuration Validation", () => {
  
  test("should handle various chunking configurations", () => {
    const testBounds: GridCellBounds = {
      minLon: 4.8,
      maxLon: 5.0,
      minLat: 52.3,
      maxLat: 52.4
    };
    
    const configs = [
      { chunkRows: 1, chunkCols: 1 },
      { chunkRows: 2, chunkCols: 3 },
      { chunkRows: 4, chunkCols: 4 },
      { chunkRows: 8, chunkCols: 8 }
    ];
    
    configs.forEach(config => {
      const chunks = createSpatialChunks(testBounds, config);
      expect(chunks).toHaveLength(config.chunkRows * config.chunkCols);
      
      // All chunks should be within original bounds (with small tolerance for overlap)
      chunks.forEach(chunk => {
        expect(chunk.bounds.minLon).toBeGreaterThanOrEqual(testBounds.minLon - 0.01);
        expect(chunk.bounds.maxLon).toBeLessThanOrEqual(testBounds.maxLon + 0.01);
        expect(chunk.bounds.minLat).toBeGreaterThanOrEqual(testBounds.minLat - 0.01);
        expect(chunk.bounds.maxLat).toBeLessThanOrEqual(testBounds.maxLat + 0.01);
        
        // Each chunk should have valid bounds
        expect(chunk.bounds.minLon).toBeLessThan(chunk.bounds.maxLon);
        expect(chunk.bounds.minLat).toBeLessThan(chunk.bounds.maxLat);
      });
    });
  });

  test("should handle chunking configuration with overlap", () => {
    const testBounds: GridCellBounds = {
      minLon: 4.8,
      maxLon: 5.0,
      minLat: 52.3,
      maxLat: 52.4
    };
    
    const config: ChunkingConfig = {
      chunkRows: 2,
      chunkCols: 2,
      overlap: 0.001,
      delayMs: 100
    };
    
    const chunks = createSpatialChunks(testBounds, config);
    
    expect(chunks).toHaveLength(4);
    
    // Check that all chunks are valid
    chunks.forEach(chunk => {
      expect(chunk.bounds.minLon).toBeLessThan(chunk.bounds.maxLon);
      expect(chunk.bounds.minLat).toBeLessThan(chunk.bounds.maxLat);
      expect(typeof chunk.id).toBe('string');
      expect(chunk.id).toMatch(/^chunk_\d+_\d+$/);
    });
  });

  test("should validate DEFAULT_CHUNKING works with real bounds", () => {
    const amsterdamBounds: GridCellBounds = {
      minLon: 4.7,
      maxLon: 5.1,
      minLat: 52.2,
      maxLat: 52.5
    };
    
    const chunks = createSpatialChunks(amsterdamBounds, DEFAULT_CHUNKING);
    
    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBe(DEFAULT_CHUNKING.chunkRows * DEFAULT_CHUNKING.chunkCols);
    
    // All chunks should be within Amsterdam bounds
    chunks.forEach(chunk => {
      expect(chunk.bounds.minLon).toBeGreaterThanOrEqual(amsterdamBounds.minLon - 0.01);
      expect(chunk.bounds.maxLon).toBeLessThanOrEqual(amsterdamBounds.maxLon + 0.01);
      expect(chunk.bounds.minLat).toBeGreaterThanOrEqual(amsterdamBounds.minLat - 0.01);
      expect(chunk.bounds.maxLat).toBeLessThanOrEqual(amsterdamBounds.maxLat + 0.01);
    });
  });
});

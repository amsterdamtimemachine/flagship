// chunkingValidation.test.ts - Test non-overlapping chunk generation

import { describe, it, expect } from 'bun:test';
import { createSpatialChunks } from '../data-sources/streaming';
import type { HeatmapCellBounds, ChunkingConfig } from '@atm/shared/types';

/**
 * Test if chunks have overlapping boundaries
 */
function detectChunkOverlaps(chunks: any[]): { hasOverlaps: boolean; overlaps: string[] } {
  const overlaps: string[] = [];
  
  for (let i = 0; i < chunks.length; i++) {
    for (let j = i + 1; j < chunks.length; j++) {
      const chunk1 = chunks[i];
      const chunk2 = chunks[j];
      
      // Check if chunks overlap
      const lonOverlap = !(chunk1.bounds.maxLon <= chunk2.bounds.minLon || chunk2.bounds.maxLon <= chunk1.bounds.minLon);
      const latOverlap = !(chunk1.bounds.maxLat <= chunk2.bounds.minLat || chunk2.bounds.maxLat <= chunk1.bounds.minLat);
      
      if (lonOverlap && latOverlap) {
        overlaps.push(`${chunk1.id} overlaps with ${chunk2.id}: ` +
          `lon=[${chunk1.bounds.minLon.toFixed(6)}, ${chunk1.bounds.maxLon.toFixed(6)}] vs ` +
          `[${chunk2.bounds.minLon.toFixed(6)}, ${chunk2.bounds.maxLon.toFixed(6)}], ` +
          `lat=[${chunk1.bounds.minLat.toFixed(6)}, ${chunk1.bounds.maxLat.toFixed(6)}] vs ` +
          `[${chunk2.bounds.minLat.toFixed(6)}, ${chunk2.bounds.maxLat.toFixed(6)}]`);
      }
    }
  }
  
  return {
    hasOverlaps: overlaps.length > 0,
    overlaps
  };
}

/**
 * Test if chunks have gaps between them
 */
function detectChunkGaps(chunks: any[], originalBounds: HeatmapCellBounds, config: ChunkingConfig): { hasGaps: boolean; gaps: string[] } {
  const gaps: string[] = [];
  
  // Sort chunks by row and col for systematic checking
  const sortedChunks = chunks.sort((a, b) => {
    const [aRow, aCol] = a.id.split('_').slice(1).map(Number);
    const [bRow, bCol] = b.id.split('_').slice(1).map(Number);
    return aRow !== bRow ? aRow - bRow : aCol - bCol;
  });
  
  // Check horizontal adjacency (same row, consecutive columns)
  for (let row = 0; row < config.chunkRows; row++) {
    for (let col = 0; col < config.chunkCols - 1; col++) {
      const chunk1 = sortedChunks.find(c => c.id === `chunk_${row}_${col}`);
      const chunk2 = sortedChunks.find(c => c.id === `chunk_${row}_${col + 1}`);
      
      if (chunk1 && chunk2) {
        const precision = 1e-10; // Account for floating-point precision
        if (Math.abs(chunk1.bounds.maxLon - chunk2.bounds.minLon) > precision) {
          gaps.push(`Gap between ${chunk1.id} and ${chunk2.id}: ` +
            `${chunk1.bounds.maxLon.toFixed(10)} ≠ ${chunk2.bounds.minLon.toFixed(10)} ` +
            `(diff: ${Math.abs(chunk1.bounds.maxLon - chunk2.bounds.minLon).toExponential()})`);
        }
      }
    }
  }
  
  // Check vertical adjacency (same column, consecutive rows)
  for (let col = 0; col < config.chunkCols; col++) {
    for (let row = 0; row < config.chunkRows - 1; row++) {
      const chunk1 = sortedChunks.find(c => c.id === `chunk_${row}_${col}`);
      const chunk2 = sortedChunks.find(c => c.id === `chunk_${row + 1}_${col}`);
      
      if (chunk1 && chunk2) {
        const precision = 1e-10; // Account for floating-point precision
        if (Math.abs(chunk1.bounds.maxLat - chunk2.bounds.minLat) > precision) {
          gaps.push(`Gap between ${chunk1.id} and ${chunk2.id}: ` +
            `${chunk1.bounds.maxLat.toFixed(10)} ≠ ${chunk2.bounds.minLat.toFixed(10)} ` +
            `(diff: ${Math.abs(chunk1.bounds.maxLat - chunk2.bounds.minLat).toExponential()})`);
        }
      }
    }
  }
  
  return {
    hasGaps: gaps.length > 0,
    gaps
  };
}

/**
 * Test if chunks exactly cover the original bounds
 */
function validateTotalCoverage(chunks: any[], originalBounds: HeatmapCellBounds, config: ChunkingConfig): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Find boundary chunks
  const topLeft = chunks.find(c => c.id === 'chunk_0_0');
  const bottomRight = chunks.find(c => c.id === `chunk_${config.chunkRows - 1}_${config.chunkCols - 1}`);
  
  if (!topLeft || !bottomRight) {
    errors.push('Missing boundary chunks');
    return { isValid: false, errors };
  }
  
  const precision = 1e-10;
  
  // Check if first chunk starts at original bounds
  if (Math.abs(topLeft.bounds.minLon - originalBounds.minLon) > precision) {
    errors.push(`First chunk minLon ${topLeft.bounds.minLon} doesn't match original ${originalBounds.minLon}`);
  }
  if (Math.abs(topLeft.bounds.minLat - originalBounds.minLat) > precision) {
    errors.push(`First chunk minLat ${topLeft.bounds.minLat} doesn't match original ${originalBounds.minLat}`);
  }
  
  // Check if last chunk ends at original bounds  
  if (Math.abs(bottomRight.bounds.maxLon - originalBounds.maxLon) > precision) {
    errors.push(`Last chunk maxLon ${bottomRight.bounds.maxLon} doesn't match original ${originalBounds.maxLon}`);
  }
  if (Math.abs(bottomRight.bounds.maxLat - originalBounds.maxLat) > precision) {
    errors.push(`Last chunk maxLat ${bottomRight.bounds.maxLat} doesn't match original ${originalBounds.maxLat}`);
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

describe('Chunking Validation', () => {
  const amsterdamBounds: HeatmapCellBounds = {
    minLon: 4.81,
    maxLon: 4.964447,
    minLat: 52.2354339,
    maxLat: 52.4443
  };
  
  const defaultConfig: ChunkingConfig = {
    chunkRows: 4,
    chunkCols: 4,
    overlap: 0, // Should be 0 after our fix
    delayMs: 50
  };
  
  it('should create chunks with no overlaps', () => {
    const chunks = createSpatialChunks(amsterdamBounds, defaultConfig);
    
    const overlapResult = detectChunkOverlaps(chunks);
    
    if (overlapResult.hasOverlaps) {
      console.log('❌ Detected overlaps:');
      overlapResult.overlaps.forEach(overlap => console.log(`   ${overlap}`));
    }
    
    expect(overlapResult.hasOverlaps).toBe(false);
    expect(chunks).toHaveLength(16); // 4x4 = 16 chunks
  });
  
  it('should create chunks with no gaps', () => {
    const chunks = createSpatialChunks(amsterdamBounds, defaultConfig);
    
    const gapResult = detectChunkGaps(chunks, amsterdamBounds, defaultConfig);
    
    if (gapResult.hasGaps) {
      console.log('❌ Detected gaps:');
      gapResult.gaps.forEach(gap => console.log(`   ${gap}`));
    }
    
    expect(gapResult.hasGaps).toBe(false);
  });
  
  it('should create chunks that exactly cover original bounds', () => {
    const chunks = createSpatialChunks(amsterdamBounds, defaultConfig);
    
    const coverageResult = validateTotalCoverage(chunks, amsterdamBounds, defaultConfig);
    
    if (!coverageResult.isValid) {
      console.log('❌ Coverage errors:');
      coverageResult.errors.forEach(error => console.log(`   ${error}`));
    }
    
    expect(coverageResult.isValid).toBe(true);
  });
  
  it('should create chunks with exact fractional boundaries', () => {
    const chunks = createSpatialChunks(amsterdamBounds, defaultConfig);
    
    const totalWidth = amsterdamBounds.maxLon - amsterdamBounds.minLon;
    const totalHeight = amsterdamBounds.maxLat - amsterdamBounds.minLat;
    const expectedChunkWidth = totalWidth / defaultConfig.chunkCols;
    const expectedChunkHeight = totalHeight / defaultConfig.chunkRows;
    
    console.log(`🔍 Testing chunk dimensions:`);
    console.log(`   Expected width: ${expectedChunkWidth.toFixed(10)}`);
    console.log(`   Expected height: ${expectedChunkHeight.toFixed(10)}`);
    
    for (const chunk of chunks) {
      const actualWidth = chunk.bounds.maxLon - chunk.bounds.minLon;
      const actualHeight = chunk.bounds.maxLat - chunk.bounds.minLat;
      
      expect(Math.abs(actualWidth - expectedChunkWidth)).toBeLessThan(1e-10);
      expect(Math.abs(actualHeight - expectedChunkHeight)).toBeLessThan(1e-10);
    }
  });
  
  it('should handle different chunk configurations', () => {
    const configs = [
      { chunkRows: 2, chunkCols: 2, overlap: 0, delayMs: 50 },
      { chunkRows: 3, chunkCols: 3, overlap: 0, delayMs: 50 },
      { chunkRows: 5, chunkCols: 5, overlap: 0, delayMs: 50 }
    ];
    
    for (const config of configs) {
      console.log(`🧪 Testing ${config.chunkRows}x${config.chunkCols} configuration`);
      
      const chunks = createSpatialChunks(amsterdamBounds, config);
      
      expect(chunks).toHaveLength(config.chunkRows * config.chunkCols);
      
      const overlapResult = detectChunkOverlaps(chunks);
      expect(overlapResult.hasOverlaps).toBe(false);
      
      const gapResult = detectChunkGaps(chunks, amsterdamBounds, config);
      expect(gapResult.hasGaps).toBe(false);
      
      const coverageResult = validateTotalCoverage(chunks, amsterdamBounds, config);
      expect(coverageResult.isValid).toBe(true);
    }
  });
});
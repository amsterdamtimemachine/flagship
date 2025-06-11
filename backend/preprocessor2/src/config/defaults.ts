// src/config/defaults.ts - Simple, configurable defaults

import type { DatabaseConfig, GridConfig } from './types';
import type { ChunkingConfig } from '../data-sources/types';

export const AMSTERDAM_DATABASE_CONFIG: DatabaseConfig = {
  baseUrl: 'https://atmbackend.create.humanities.uva.nl',
  batchSize: 200, // Good balance between speed and memory
  timeout: 30000, // 30 second timeout
  defaultParams: {
    // Don't set recordtype by default - let it fetch all types
  }
};

export const AMSTERDAM_BOUNDS = {
  minLon: 4.7,
  maxLon: 5.1,
  minLat: 52.2,
  maxLat: 52.5
};

export const DEFAULT_GRID_CONFIG: GridConfig = {
  colsAmount: 100,
  rowsAmount: 100,
  padding: 0.05 // 5% padding around Amsterdam
};

// Simple, proven chunking configurations
export const DEFAULT_CHUNKING: ChunkingConfig = {
  chunkRows: 2,
  chunkCols: 2,
  overlap: 0.001, // Small overlap for boundary features
  delayMs: 200    // Don't overwhelm the API
};

export const MEMORY_EFFICIENT_CHUNKING: ChunkingConfig = {
  chunkRows: 4,
  chunkCols: 4,
  overlap: 0.001,
  delayMs: 300
};

export const HIGH_PERFORMANCE_CHUNKING: ChunkingConfig = {
  chunkRows: 1,
  chunkCols: 1,
  delayMs: 100 // Single chunk, faster processing
};

// Preset configurations for different scenarios
export const PRESETS = {
  // For testing and development (small grid, single chunk)
  DEVELOPMENT: {
    database: AMSTERDAM_DATABASE_CONFIG,
    grid: { colsAmount: 20, rowsAmount: 20, padding: 0.05 },
    chunking: HIGH_PERFORMANCE_CHUNKING
  },
  
  // For production (balanced memory and performance)
  PRODUCTION: {
    database: AMSTERDAM_DATABASE_CONFIG,
    grid: DEFAULT_GRID_CONFIG,
    chunking: DEFAULT_CHUNKING
  },
  
  // For memory-constrained servers
  MEMORY_EFFICIENT: {
    database: { ...AMSTERDAM_DATABASE_CONFIG, batchSize: 100 },
    grid: DEFAULT_GRID_CONFIG,
    chunking: MEMORY_EFFICIENT_CHUNKING
  },
  
  // For high-resolution processing
  HIGH_RESOLUTION: {
    database: AMSTERDAM_DATABASE_CONFIG,
    grid: { colsAmount: 200, rowsAmount: 200, padding: 0.05 },
    chunking: MEMORY_EFFICIENT_CHUNKING // Use more chunks for high-res
  }
};

// Helper function to get preset
export function getPreset(presetName: keyof typeof PRESETS) {
  return PRESETS[presetName];
}

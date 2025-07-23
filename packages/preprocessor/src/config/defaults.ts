// src/config/defaults.ts - Environment-configurable defaults

import type { DatabaseConfig, ChunkingConfig, HeatmapConfig } from '@atm/shared/types';

export const AMSTERDAM_DATABASE_CONFIG: DatabaseConfig = {
  baseUrl: process.env.DATABASE_BASE_URL || 'https://atmbackend.create.humanities.uva.nl',
  batchSize: parseInt(process.env.DATABASE_BATCH_SIZE || '') || 2000,
  timeout: parseInt(process.env.DATABASE_TIMEOUT || '') || 30000,
  defaultParams: {}
};

export const AMSTERDAM_BOUNDS = {
  minLon: parseFloat(process.env.BOUNDS_MIN_LON || '') || 4.85,
  maxLon: parseFloat(process.env.BOUNDS_MAX_LON || '') || 4.95,
  minLat: parseFloat(process.env.BOUNDS_MIN_LAT || '') || 52.35,
  maxLat: parseFloat(process.env.BOUNDS_MAX_LAT || '') || 52.4
};

export const DEFAULT_GRID_CONFIG: HeatmapConfig = {
  colsAmount: parseInt(process.env.GRID_COLS || '') || 20,
  rowsAmount: parseInt(process.env.GRID_ROWS || '') || 20,
  padding: parseFloat(process.env.GRID_PADDING || '') || 0.05 // 5% padding around Amsterdam
};

// Production chunking configuration
export const DEFAULT_CHUNKING: ChunkingConfig = {
  chunkRows: parseInt(process.env.CHUNK_ROWS || '') || 4,
  chunkCols: parseInt(process.env.CHUNK_COLS || '') || 4,
  overlap: parseFloat(process.env.CHUNK_OVERLAP || '') || 0.001, // Small overlap for boundary features
  delayMs: parseInt(process.env.CHUNK_DELAY_MS || '') || 50 // Don't overwhelm the API
};

// Production configuration
export const PRODUCTION_PRESET = {
  database: AMSTERDAM_DATABASE_CONFIG,
  resolutionCanonical: DEFAULT_GRID_CONFIG,
  chunking: DEFAULT_CHUNKING
};

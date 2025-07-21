// src/config/defaults.ts - Simple, configurable defaults

import type { DatabaseConfig, ChunkingConfig, HeatmapConfig } from '@atm/shared/types';

export const AMSTERDAM_DATABASE_CONFIG: DatabaseConfig = {
  baseUrl: 'https://atmbackend.create.humanities.uva.nl',
  batchSize: 400, 
  timeout: 30000, 
  defaultParams: {}
};

export const AMSTERDAM_BOUNDS = {
  minLon: 4.85,  
  maxLon: 4.95, 
  minLat: 52.35, 
  maxLat: 52.4  
};

export const DEFAULT_GRID_CONFIG: HeatmapConfig = {
  colsAmount: 20,
  rowsAmount: 20,
  padding: 0.05 // 5% padding around Amsterdam
};

// Production chunking configuration
export const DEFAULT_CHUNKING: ChunkingConfig = {
  chunkRows: 2,
  chunkCols: 2,
  overlap: 0.001, // Small overlap for boundary features
  delayMs: 200    // Don't overwhelm the API
};

// Production configuration
export const PRODUCTION_PRESET = {
  database: AMSTERDAM_DATABASE_CONFIG,
  resolutionCanonical: DEFAULT_GRID_CONFIG,
  chunking: DEFAULT_CHUNKING
};

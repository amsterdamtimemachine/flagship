// src/index.ts - Main entry point for Amsterdam Time Machine Preprocessor
export * from './processing/heatmap_discovery';
export * from './processing/histogram';
export * from './serialization/visualization';
export * from './data-sources/database';
export * from './config/defaults';

// Re-export main function for programmatic usage
export { default as main } from './main_discovery';

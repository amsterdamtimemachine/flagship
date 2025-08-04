// src/index.ts - Main entry point for Amsterdam Time Machine Preprocessor
export * from './visualization/heatmap';
export * from './visualization/histogram';
export * from './serialization/binaryExport';
export * from './data-sources/database';
export * from './config/defaults';

// Re-export main function for programmatic usage
export { default as main } from './main';

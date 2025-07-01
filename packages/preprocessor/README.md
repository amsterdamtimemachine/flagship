# Amsterdam Time Machine Preprocessor

Data preprocessing pipeline that generates binary visualization files for the Amsterdam Time Machine project.

## Overview

This preprocessor fetches data from the Amsterdam API, processes it into heatmaps and histograms, and creates an efficient binary file format for the frontend application.

## Quick Start

### Generate Development Binary (Recommended for testing)
```bash
npm run generate:dev
```
This creates `visualization-dev.bin` with:
- Small 20x20 grid for fast processing
- Multiple test resolutions (8x8, 16x16, 32x32)
- Single chunk for simple debugging

### Generate Production Binary
```bash
npm run generate:prod  
```
This creates `visualization.bin` with:
- Full 100x100 grid resolution
- Optimized chunking for performance
- Production-ready dataset

### Generate Test Binary
```bash
npm run generate:test
```
Creates `test-data.bin` for automated testing.

## Configuration Presets

### DEVELOPMENT
- **Grid**: 20x20 (400 cells)
- **Chunking**: 1x1 (single chunk)
- **Use case**: Quick testing, debugging

### PRODUCTION  
- **Grid**: 100x100 (10,000 cells)
- **Chunking**: 2x2 (4 chunks)
- **Use case**: Production deployment

### MEMORY_EFFICIENT
- **Grid**: 100x100 (10,000 cells) 
- **Chunking**: 4x4 (16 chunks)
- **Use case**: Memory-constrained servers

### HIGH_RESOLUTION
- **Grid**: 200x200 (40,000 cells)
- **Chunking**: 4x4 (16 chunks)
- **Use case**: High-detail visualization

## Custom Usage

```bash
# Custom preset and output path
bun run src/main.ts --preset PRODUCTION --output ./my-data.bin

# Include test resolutions
bun run src/main.ts --preset DEVELOPMENT --test-resolutions

# Help
bun run src/main.ts --help
```

## Environment Variables

```bash
PRESET=DEVELOPMENT                    # Configuration preset
OUTPUT_PATH=./visualization.bin       # Output file path
INCLUDE_TEST_RESOLUTIONS=true         # Add test resolutions
```

## Output Binary Structure

The generated binary contains:
- **Metadata**: Time periods, record types, tags, grid dimensions
- **Heatmaps**: Spatial data for multiple resolutions and time periods
- **Histograms**: Temporal data for different record types and tags

## Time Periods Processed

- 1600-1700 (17th century)
- 1700-1800 (18th century)  
- 1800-1850 (Early 19th century)
- 1850-1900 (Late 19th century)
- 1900-1950 (Early 20th century)
- 1950-2000 (Late 20th century)
- 2000-2024 (21st century)

## Record Types

- **text**: Text documents and records
- **image**: Images and visual materials  
- **event**: Events and activities

## Using Generated Binary

1. **Copy to your app**:
   ```bash
   cp ./visualization-dev.bin ../app/data/
   ```

2. **Set environment variable**:
   ```bash
   # In your SvelteKit app's .env
   VISUALIZATION_BINARY_PATH=./data/visualization-dev.bin
   ```

3. **Test the API**:
   ```bash
   curl http://localhost:5173/api/metadata
   curl http://localhost:5173/api/histogram?recordType=text
   curl http://localhost:5173/api/heatmaps?recordType=text
   ```

## Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test binary generation specifically  
npm run test:binary

# Clean generated files
npm run clean
```

## File Sizes (Approximate)

- **DEVELOPMENT**: ~1-5 MB
- **PRODUCTION**: ~50-200 MB  
- **HIGH_RESOLUTION**: ~200-500 MB

Actual sizes depend on data density and number of features in the Amsterdam dataset.
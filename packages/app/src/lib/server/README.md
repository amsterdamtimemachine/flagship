# SvelteKit API Integration

This directory contains the server-side components for the Amsterdam Time Machine visualization API integration.

## Overview

The API provides two main endpoints for accessing pre-processed visualization data from a binary file using memory mapping for optimal performance:

1. **`/api/histogram`** - Returns histogram data for temporal analysis
2. **`/api/heatmaps`** - Returns heatmap timeline data for spatial analysis
3. **`/api/metadata`** - Returns dataset metadata (optional, for debugging)

## Architecture

### Binary Handler (`binary-handler.ts`)
- Memory-maps the visualization binary file using `Bun.mmap()`
- Loads metadata into memory once on initialization
- Provides methods to read heatmaps and histograms from the memory-mapped buffer
- Handles TypedArray to regular array conversion for JSON serialization

### API Service (`api-service.ts`)
- High-level service class that wraps the binary handler
- Implements business logic for filtering and data access
- Handles error cases and response formatting
- Manages single vs. multiple tag filtering

## Endpoints

### GET /api/histogram

Returns histogram data showing feature counts over time periods.

**Query Parameters:**
- `recordType` (required): `'text' | 'image' | 'event'`
- `tags` (optional): Comma-separated list of tags (e.g., `tags=politics,culture`)

**Response:**
```typescript
{
  histogram: {
    bins: HistogramBin[];
    recordType?: RecordType;
    tags?: string[];
    maxCount: number;
    timeRange: TimeRange;
    totalFeatures: number;
  };
  success: boolean;
  message?: string;
  processingTime?: number;
}
```

**Example Usage:**
```
GET /api/histogram?recordType=text
GET /api/histogram?recordType=text&tags=politics
GET /api/histogram?recordType=image&tags=culture,art
```

### GET /api/heatmaps

Returns heatmap timeline data for spatial visualization.

**Query Parameters:**
- `recordType` (required): `'text' | 'image' | 'event'`
- `tags` (optional): Comma-separated list of tags

**Response:**
```typescript
{
  heatmapTimeline: HeatmapTimeline;
  recordType: RecordType;
  tags?: string[];
  resolution: string;
  success: boolean;
  message?: string;
  processingTime?: number;
}
```

**Example Usage:**
```
GET /api/heatmaps?recordType=text
GET /api/heatmaps?recordType=text&tags=politics
```

### GET /api/metadata

Returns dataset metadata for client initialization.

**Response:**
```typescript
{
  timeSlices: TimeSlice[];
  timeRange: { start: string; end: string };
  recordTypes: RecordType[];
  tags: string[];
  resolutions: HeatmapResolutionConfig[];
  heatmapDimensions: HeatmapDimensions;
  heatmapBlueprint: HeatmapBlueprint;
  stats?: VisualizationStats;
  success: boolean;
}
```

## Configuration

Set the binary file path via environment variable:

```bash
# .env
VISUALIZATION_BINARY_PATH=/path/to/your/visualization.bin
```

## Memory Mapping Benefits

1. **Performance**: No file I/O after initialization
2. **Memory Efficiency**: OS handles caching and memory management
3. **Scalability**: Multiple requests share the same memory-mapped data
4. **Reliability**: Bun's native mmap support provides stable access

## Error Handling

- Invalid parameters return 400 Bad Request
- Missing data returns structured error responses with success: false
- Unexpected errors return 500 Internal Server Error
- All responses include CORS headers for frontend compatibility

## Data Flow

1. **Initialization**: Binary file is memory-mapped and metadata loaded once
2. **Request**: Client requests histogram or heatmap data with filters
3. **Processing**: Service reads relevant sections from memory-mapped buffer
4. **Filtering**: Data is filtered by recordType and optionally by tags
5. **Serialization**: TypedArrays converted to regular arrays for JSON
6. **Response**: Filtered data returned with metadata and timing info

## Client Integration

Use the provided API functions in `src/lib/api.ts`:

```typescript
import { fetchHistogram, fetchHeatmapTimeline, fetchVisualizationMetadata } from '$lib/api';

// Fetch histogram for text records
const histogramResponse = await fetchHistogram('text');

// Fetch heatmap timeline for text records with politics tag
const heatmapResponse = await fetchHeatmapTimeline('text', ['politics']);

// Fetch metadata
const metadata = await fetchVisualizationMetadata();
```

## Development

1. Ensure your binary file is accessible at the configured path
2. Start the SvelteKit dev server: `npm run dev`
3. Test endpoints: `curl http://localhost:5173/api/metadata`
4. Use browser dev tools to inspect network requests and responses

## Production Deployment

1. Build the application: `npm run build`
2. Set production environment variables
3. Deploy with Bun adapter for optimal memory mapping performance
4. Monitor memory usage and file access patterns
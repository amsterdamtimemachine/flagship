// src/data-sources/database.ts - Updated for your API structure
import type { 
  RawFeature,
  ProcessedFeature, 
  Coordinates,
  AnyProcessedFeature,
  RecordType,
  ImageFeature, EventFeature, TextFeature,
} from '../types/geo';

export interface GridConfig {
  colsAmount: number;
  rowsAmount: number;
  padding: number; // e.g., 0.05 = 5% padding
}

export interface DatabaseConfig {
  baseUrl: string;
  defaultParams?: Partial<ApiQueryParams>;
  batchSize?: number;
  timeout?: number;
}

export interface ApiQueryParams {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  start_year: string;
  end_year: string;
  recordtype?: RecordType;
  limit?: number;
  offset?: number;
}

export interface ApiResponse {
  data: RawFeature[];
  total: number;
}

/**
 * Core function that makes HTTP calls to your Amsterdam API
 */
export async function fetchBatch(
  baseUrl: string, 
  params: ApiQueryParams
): Promise<ApiResponse> {
  const url = new URL('/api/geodata', baseUrl);
  
  // Add all parameters to URL
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });
  
  console.log(`📡 Fetching: ${url.toString()}`);
  
  try {
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Validate the expected response format
    if (data && Array.isArray(data.data) && typeof data.total === 'number') {
      return {
        data: data.data,
        total: data.total
      };
    } else {
      throw new Error(`Unexpected API response format: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    console.error(`🔥 API Error for ${url.toString()}:`, error);
    throw error;
  }
}

/**
 * Convert Amsterdam API feature to normalized ProcessedFeature
 */
export function convertRawFeature(rawFeature: RawFeature, recordtype: RecordType): AnyProcessedFeature {
    // Parse WKT geometry
    const coordinates = parseWKTPoint(rawFeature.geom);
    
    const baseFeature = {
        title: rawFeature.tit,
        dataset: rawFeature.ds,
        url: rawFeature.url,
        recordtype,
        tags: rawFeature.tags || [],
        
        // Temporal data
        startYear: rawFeature.per[0],
        endYear: rawFeature.per[1],
        
        // Spatial data
        geometry: {
            type: 'Point' as const,
            coordinates: coordinates
        }
    };

    // Assign properties based on record type
    if (recordtype === 'image') {
        return {
            ...baseFeature,
            properties: {
                thumb: rawFeature.url
            }
        } as ImageFeature;
    } else if (recordtype === 'event') {
        return {
            ...baseFeature,
            properties: {
                street_name: '',
                city_name: '',
                info: '',
                venue_type: ''
            }
        } as EventFeature;
    } else {
        // text type - no properties
        return {
            ...baseFeature
        } as TextFeature;
    }
}

/**
 * Parse WKT POINT string to [lon, lat] coordinates
 */
function parseWKTPoint(wktGeom: string): Coordinates {
  // Example: "POINT(4.88134747873096 52.3638068249909)"
  const match = wktGeom.match(/POINT\(([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\)/);
  
  if (!match) {
    throw new Error(`Cannot parse WKT geometry: ${wktGeom}`);
  }
  
  const lon = parseFloat(match[1]);
  const lat = parseFloat(match[2]);
  
  if (isNaN(lon) || isNaN(lat)) {
    throw new Error(`Invalid coordinates in WKT: ${wktGeom}`);
  }
  
  return {lon: lon, lat: lat};
}

/**
 * Get feature statistics from API response
 */
export function analyzeFeatures(features: ProcessedFeature[]): {
  totalFeatures: number;
  datasets: Record<string, number>;
  recordTypes: Record<string, number>;
  timeRange: { earliest: number; latest: number };
  tagStats: { totalTags: number; uniqueTags: number; topTags: Array<{tag: string; count: number}> };
} {
  const datasets: Record<string, number> = {};
  const recordTypes: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};
  
  let earliest = Infinity;
  let latest = -Infinity;
  
  for (const feature of features) {
    // Dataset analysis
    datasets[feature.dataset] = (datasets[feature.dataset] || 0) + 1;
    
    // Record type analysis
    if (feature.recordtype) {
      recordTypes[feature.recordtype] = (recordTypes[feature.recordtype] || 0) + 1;
    }
    
    // Time range analysis
    earliest = Math.min(earliest, feature.startYear);
    latest = Math.max(latest, feature.endYear);
    
    // Tag analysis
    for (const tag of feature.tags) {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    }
  }
  
  // Top tags
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));
  
  return {
    totalFeatures: features.length,
    datasets,
    recordTypes,
    timeRange: { earliest, latest },
    tagStats: {
      totalTags: Object.values(tagCounts).reduce((sum, count) => sum + count, 0),
      uniqueTags: Object.keys(tagCounts).length,
      topTags
    }
  };
}

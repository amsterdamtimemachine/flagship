// src/data-sources/database.ts - Updated for your API structure
import type { 
  RawFeature,
  ProcessedFeature, 
  Coordinates,
  AnyProcessedFeature,
  RecordType,
  ImageFeature, EventFeature, TextFeature,
  MinimalFeature,
  DatabaseConfig,
  ApiQueryParams, ApiResponse,
} from '@atm/shared/types';
import { parseWKTPoint } from '@atm/shared/utils/geometry';

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
        total: data.total,
        page: data.page || 1,
        page_size: data.page_size || data.data.length,
        returned: data.returned || data.data.length,
        total_pages: data.total_pages || Math.ceil(data.total / (data.page_size || data.data.length))
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
 * Convert raw feature to processed feature
 * Note: This function is being phased out in favor of createMinimalFeature for discovery modules
 */
export function convertRawFeature(rawFeature: RawFeature, recordType: RecordType): AnyProcessedFeature {
    // Parse WKT geometry
    const coordinates = parseWKTPoint(rawFeature.geom);
    
    const baseFeature = {
        title: rawFeature.tit,
        dataset: rawFeature.ds,
        url: rawFeature.url,
        recordType,
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
    if (recordType === 'image') {
        return {
            ...baseFeature,
            properties: {
                thumb: rawFeature.url
            }
        } as ImageFeature;
    } else if (recordType === 'event') {
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
 * Lightweight feature processor for discovery modules
 * Only extracts essential fields needed for accumulator processing
 */
export function createMinimalFeature(rawFeature: RawFeature, recordType: RecordType): MinimalFeature {
  return {
    coordinates: parseWKTPoint(rawFeature.geom),
    recordType,
    tags: rawFeature.tags || [],
    startYear: rawFeature.per[0],
    endYear: rawFeature.per[1]
  };
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
    if (feature.recordType) {
      recordTypes[feature.recordType] = (recordTypes[feature.recordType] || 0) + 1;
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

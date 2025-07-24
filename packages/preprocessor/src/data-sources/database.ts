// src/data-sources/database.ts - Updated for your API structure
import type { 
  RawFeature,
  Coordinates,
  RecordType,
  MinimalFeature,
  DatabaseConfig,
  ApiQueryParams, ApiResponse,
} from '@atm/shared/types';
import { parseWKTPoint } from '@atm/shared';

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


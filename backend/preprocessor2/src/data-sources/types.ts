// src/data-sources/types.ts - Updated for your API structure

import type { RawFeature, RecordType } from '../types/geo';

export interface DatabaseConfig {
  baseUrl: string;
  defaultParams?: Partial<ApiQueryParams>;
  batchSize?: number;
  timeout?: number;
}

// Your API query parameters
export interface ApiQueryParams {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
  start_year: string;   // ISO date format like "1900-01-01"
  end_year: string;     // ISO date format like "1931-01-01"
  recordtype?: RecordType; // Optional filter
  limit?: number;
  offset?: number;
}

// Your API response format
export interface ApiResponse {
  data: RawFeature[];
  total: number;
}

export interface ApiBounds {
  min_lat: number;
  min_lon: number;
  max_lat: number;
  max_lon: number;
}


import type { RecordType } from '../types/geo';

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

export interface GridConfig {
  colsAmount: number;
  rowsAmount: number;
  padding: number; // e.g., 0.05 = 5% padding
}

// src/routes/api/histogram/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecordType, HistogramApiResponse } from '@atm/shared/types';
import { getApiService } from '$lib/server/apiServiceSingleton';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters
    const recordTypesParam = url.searchParams.get('recordTypes');
    const tagsParam = url.searchParams.get('tags');
    
    // Get API service to access metadata for defaulting
    const apiService = await getApiService();
    
    // Parse recordTypes - default to all available recordTypes if none specified
    let recordTypes: RecordType[];
    if (!recordTypesParam) {
      const metadata = await apiService.getVisualizationMetadata();
      recordTypes = metadata.recordTypes;
      console.log(`📊 No recordTypes specified, defaulting to all: ${recordTypes.join(', ')}`);
    } else {
      recordTypes = recordTypesParam.split(',').map(t => t.trim()) as RecordType[];
    }

    // Parse tags if provided
    let tags: string[] | undefined;
    if (tagsParam) {
      tags = tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    console.log(`📊 Histogram API request - recordTypes: ${recordTypes.join(', ')}, tags: ${tags?.join(', ') || 'none'}`);

    // Get histogram from service
    const response = await apiService.getHistogram(recordTypes, tags);

    // Set appropriate cache headers
    const headers = {
      'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      'Access-Control-Allow-Origin': '*'
    };

    if (response.success) {
      console.log(`✅ Histogram API success - ${response.histogram.totalFeatures} features, ${response.histogram.bins.length} periods`);
      return json<HistogramApiResponse>(response, { headers });
    } else {
      console.error(`❌ Histogram API error: ${response.message}`);
      return error(500, { message: response.message || 'Failed to load histogram data' });
    }

  } catch (err) {
    console.error('❌ Histogram API unexpected error:', err);
    return error(500, { message: err instanceof Error ? err.message : 'Internal server error' });
  }
};

// Handle preflight requests for CORS
export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
};

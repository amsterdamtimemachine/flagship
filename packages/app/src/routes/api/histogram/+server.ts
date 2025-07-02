// src/routes/api/histogram/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecordType, HistogramApiResponse } from '@atm/shared/types';
import { getApiService } from '$lib/server/apiServiceSingleton';

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters
    const recordType = url.searchParams.get('recordType') as RecordType;
    const tagsParam = url.searchParams.get('tags');
    
    // Validate recordType
    if (!recordType) {
      return error(400, { message: 'recordType parameter is required' });
    }
    
    const validRecordTypes: RecordType[] = ['text', 'image', 'event'];
    if (!validRecordTypes.includes(recordType)) {
      return error(400, { message: `Invalid recordType. Must be one of: ${validRecordTypes.join(', ')}` });
    }

    // Parse tags if provided
    let tags: string[] | undefined;
    if (tagsParam) {
      tags = tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    console.log(`📊 Histogram API request - recordType: ${recordType}, tags: ${tags?.join(', ') || 'none'}`);

    // Get histogram from service
    const apiService = await getApiService();
    const response = await apiService.getHistogram(recordType, tags);

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
      return json(response, { status: 500, headers });
    }

  } catch (err) {
    console.error('❌ Histogram API unexpected error:', err);
    
    return json<HistogramApiResponse>({
      histogram: {
        bins: [],
        maxCount: 0,
        timeRange: { start: '', end: '' },
        totalFeatures: 0
      },
      success: false,
      message: err instanceof Error ? err.message : 'Internal server error'
    }, { 
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*'
      }
    });
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

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
    
    // Validate recordTypes
    if (!recordTypesParam) {
      return error(400, { message: 'recordTypes parameter is required' });
    }
    
    const validRecordTypes: RecordType[] = ['text', 'image', 'event'];
    const recordTypes = recordTypesParam.split(',').map(t => t.trim()) as RecordType[];
    const invalidTypes = recordTypes.filter(type => !validRecordTypes.includes(type));
    
    if (invalidTypes.length > 0) {
      return error(400, { message: `Invalid recordTypes: ${invalidTypes.join(', ')}. Must be one of: ${validRecordTypes.join(', ')}` });
    }

    // Parse tags if provided
    let tags: string[] | undefined;
    if (tagsParam) {
      tags = tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
    }

    console.log(`📊 Histogram API request - recordTypes: ${recordTypes.join(', ')}, tags: ${tags?.join(', ') || 'none'}`);

    // Get histogram from service
    const apiService = await getApiService();
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
      recordTypes: recordTypes || [],
      tags,
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

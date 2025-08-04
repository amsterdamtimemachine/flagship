// src/routes/api/available-tags/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecordType } from '@atm/shared/types';
import { getApiService } from '$lib/server/apiServiceSingleton';

interface AvailableTagsResponse {
  tags: Array<{ name: string; totalFeatures: number; recordTypes: RecordType[] }>;
  recordTypes: RecordType[];
  success: boolean;
  message?: string;
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters
    const recordTypesParam = url.searchParams.get('recordTypes');
    
    // Get API service
    const apiService = await getApiService();
    
    // Parse recordTypes - default to all available recordTypes if none specified
    let recordTypes: RecordType[] | undefined;
    if (recordTypesParam) {
      recordTypes = recordTypesParam.split(',').map(t => t.trim()) as RecordType[];
    }

    console.log(`🏷️ Available tags API request - recordTypes: ${recordTypes?.join(', ') || 'all'}`);

    // Get available tags from service
    const response = await apiService.getAvailableTags(recordTypes);

    // Set appropriate cache headers
    const headers = {
      'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes (shorter than other data)
      'Access-Control-Allow-Origin': '*'
    };

    if (response.success) {
      const tagCount = response.tags.length;
      const totalFeatures = response.tags.reduce((sum, tag) => sum + tag.totalFeatures, 0);
      console.log(`✅ Available tags API success - ${tagCount} tags with ${totalFeatures} total features`);
      return json<AvailableTagsResponse>(response, { headers });
    } else {
      console.error(`❌ Available tags API error: ${response.message}`);
      return error(500, { message: response.message || 'Failed to load available tags' });
    }

  } catch (err) {
    console.error('❌ Available tags API unexpected error:', err);
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
// src/routes/api/tag-combinations/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecordType } from '@atm/shared/types';
import { getApiService } from '$lib/server/apiServiceSingleton';

interface TagCombinationsResponse {
  availableTags: Array<{ name: string; totalFeatures: number }>;
  currentSelection: string[];
  recordTypes: RecordType[];
  success: boolean;
  message?: string;
  // New fields for validation
  validTags?: string[];
  invalidTags?: string[];
}

export const GET: RequestHandler = async ({ url }) => {
  try {
    // Parse query parameters
    const recordTypesParam = url.searchParams.get('recordTypes');
    const selectedParam = url.searchParams.get('selected');
    const validateAllParam = url.searchParams.get('validateAll');
    
    // Get API service
    const apiService = await getApiService();
    
    // Parse recordTypes - default to all available recordTypes if none specified
    let recordTypes: RecordType[] | undefined;
    if (recordTypesParam) {
      recordTypes = recordTypesParam.split(',').map(t => t.trim()) as RecordType[];
    }

    // Parse selected tags
    let selectedTags: string[] = [];
    if (selectedParam) {
      selectedTags = selectedParam.split(',').map(t => t.trim()).filter(t => t.length > 0);
    }

    console.log(`🔗 Tag combinations API request - recordTypes: ${recordTypes?.join(', ') || 'all'}, selected: ${selectedTags.join(', ') || 'none'}, validateAll: ${validateAllParam}`);

    // Handle validation mode
    if (validateAllParam === 'true' && selectedTags.length > 0) {
      // Use direct validation against precomputed combinations
      const validationResult = await apiService.validateTagCombination(recordTypes, selectedTags);
      
      // Set appropriate cache headers
      const headers = {
        'Cache-Control': 'public, max-age=1800',
        'Access-Control-Allow-Origin': '*'
      };
      
      console.log(`✅ Tag validation complete - valid: ${validationResult.validTags.join(', ')}, invalid: ${validationResult.invalidTags.join(', ')}`);
      
      return json<TagCombinationsResponse>({
        availableTags: [],
        currentSelection: validationResult.validTags,
        recordTypes: recordTypes || [],
        success: true,
        validTags: validationResult.validTags,
        invalidTags: validationResult.invalidTags
      }, { headers });
    }
    
    // Normal mode: get available next tags
    const response = await apiService.getTagCombinations(recordTypes, selectedTags);

    // Set appropriate cache headers
    const headers = {
      'Cache-Control': 'public, max-age=1800', // Cache for 30 minutes
      'Access-Control-Allow-Origin': '*'
    };

    if (response.success) {
      const tagCount = response.availableTags.length;
      const totalFeatures = response.availableTags.reduce((sum, tag) => sum + tag.totalFeatures, 0);
      console.log(`✅ Tag combinations API success - ${tagCount} available next tags with ${totalFeatures} total features`);
      return json<TagCombinationsResponse>(response, { headers });
    } else {
      console.error(`❌ Tag combinations API error: ${response.message}`);
      return error(500, { message: response.message || 'Failed to load tag combinations' });
    }

  } catch (err) {
    console.error('❌ Tag combinations API unexpected error:', err);
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
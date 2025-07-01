// (map)/+page.ts - Load metadata from new API with error accumulation
import type { PageLoad } from './$types';
import type { VisualizationMetadata } from '@atm/shared/types';
import type { AppError } from '$types/error';
import { createPageErrorData, createError } from '$utils/error';

interface MetadataApiResponse extends VisualizationMetadata {
  success: boolean;
  message?: string;
}

export const load: PageLoad = async ({ fetch }) => {
  const errors: AppError[] = [];
  let metadata: VisualizationMetadata | null = null;
  
  try {
    console.log('🔄 Loading metadata from API...');
    
    const response = await fetch('/api/metadata');
    
    if (!response.ok) {
      errors.push(createError(
        'error',
        'API Request Failed',
        `Failed to fetch metadata: HTTP ${response.status}`,
        { status: response.status, statusText: response.statusText }
      ));
    } else {
      const apiResponse = await response.json() as MetadataApiResponse;
      
      if (!apiResponse.success) {
        errors.push(createError(
          'error',
          'API Error',
          apiResponse.message || 'API returned unsuccessful response',
          { response: apiResponse }
        ));
      } else {
        metadata = apiResponse;
        
        console.log('✅ Metadata loaded successfully:', {
          version: metadata.version,
          timestamp: metadata.timestamp,
          timeSlices: metadata.timeSlices.length,
          recordTypes: metadata.recordTypes,
          tags: metadata.tags.length,
          resolutions: metadata.resolutions.length,
          primaryGridDimensions: `${metadata.heatmapDimensions.colsAmount}x${metadata.heatmapDimensions.rowsAmount}`,
          allResolutionDimensions: Object.keys(metadata.resolutionDimensions || {}),
          timeRange: metadata.timeRange,
          totalFeatures: metadata.stats?.totalFeatures
        });
        
        if (metadata.resolutionDimensions) {
          console.log('📐 Available resolutions:', metadata.resolutionDimensions);
        }
      }
    }
    
  } catch (err) {
    console.error('❌ Failed to load metadata:', err);
    
    errors.push(createError(
      'error',
      'Metadata Load Failed',
      'Could not load visualization metadata. Please ensure the server is running and the binary file is available.',
      { 
        error: err instanceof Error ? err.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }
    ));
  }
  
  return {
    metadata,
    errorData: createPageErrorData(errors)
  };
};

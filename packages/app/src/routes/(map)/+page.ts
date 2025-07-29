// (map)/+page.ts - Load metadata, histogram, and heatmap timeline from new API with error accumulation
import type { PageLoad } from './$types';
import type { VisualizationMetadata, HistogramApiResponse, HeatmapTimelineApiResponse, RecordType } from '@atm/shared/types';
import type { AppError } from '$types/error';
import { createPageErrorData, createError, createValidationError } from '$utils/error';
import { loadingState } from '$lib/state/loadingState.svelte';

interface MetadataApiResponse extends VisualizationMetadata {
  success: boolean;
  message?: string;
}

export const load: PageLoad = async ({ fetch, url }) => {
  loadingState.startLoading();
  
  const errors: AppError[] = [];
  let metadata: VisualizationMetadata | null = null;
  let histogram: HistogramApiResponse | null = null;
  let heatmapTimeline: HeatmapTimelineApiResponse | null = null;
  
  // Parse URL parameters
  const recordTypesParam = url.searchParams.get('recordTypes');
  const tagsParam = url.searchParams.get('tags');
  
  try { 
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
        
        // Debug: Check actual processing bounds
        console.log('🗺️ Processing bounds:', {
          primaryResolution: {
            minLon: metadata.heatmapDimensions.minLon,
            maxLon: metadata.heatmapDimensions.maxLon,
            minLat: metadata.heatmapDimensions.minLat,
            maxLat: metadata.heatmapDimensions.maxLat,
            cellWidth: metadata.heatmapDimensions.cellWidth,
            cellHeight: metadata.heatmapDimensions.cellHeight
          }
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
  
  // Determine recordTypes to use for API requests and UI state
  let currentRecordTypes: RecordType[] = [];
  
  if (metadata?.recordTypes) {
    // Handle recordTypes parameter
    if (recordTypesParam) {
      const requestedTypes = recordTypesParam.split(',').map(t => t.trim()) as RecordType[];
      const validTypes = requestedTypes.filter(type => metadata.recordTypes.includes(type));
      
      if (validTypes.length > 0) {
        currentRecordTypes = validTypes;
      } else {
        // If no valid record types are provided the app will default to fetching all data
        // Add validation error for invalid recordTypes
        errors.push(createValidationError(
          'recordTypes',
          recordTypesParam,
          `Must contain at least one of: ${metadata.recordTypes.join(', ')}`
        ));
      }
    } 
  }
  
  // Parse tags if provided
  let currentTags: string[] | undefined;

  if (metadata?.tags) {
    // Handle recordTypes parameter
    if (tagsParam) {
      const requestedTags = tagsParam.split(',').map(t => t.trim()) as string[];
      const validTags = requestedTags.filter(tag => metadata.tags.includes(tag));
      
      if (validTags.length > 0) {
        currentTags = validTags;
      } else {
        // Add validation error for invalid tags 
        errors.push(createValidationError(
          'tags',
          tagsParam,
          `Must contain at least one of: ${metadata.tags.join(', ')}`
        ));
      }
    } 
  }


   
  // Histogram promise
  const histogramPromise = (async () => {
    try {  
      const histogramUrl = `/api/histogram${currentRecordTypes.length > 0 ? `?recordTypes=${currentRecordTypes.join(',')}` : ''}${currentTags ? `${currentRecordTypes.length > 0 ? '&' : '?'}tags=${currentTags.join(',')}` : ''}` || '/api/histogram';
      const histogramResponse = await fetch(histogramUrl);
      
      if (!histogramResponse.ok) {
        // Parse error message from SvelteKit error response
        let errorMessage = `HTTP ${histogramResponse.status}`;
        try {
          const errorData = await histogramResponse.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Fallback to status text if JSON parsing fails
          errorMessage = histogramResponse.statusText || errorMessage;
        }
        
        errors.push(createError(
          'warning',
          'Histogram Load Failed',
          errorMessage,
          { recordTypes: currentRecordTypes, tags: currentTags, status: histogramResponse.status }
        ));
      } else {
        const histogramData = await histogramResponse.json() as HistogramApiResponse;
        histogram = histogramData;
      }
      
    } catch (err) {
      console.error('❌ Failed to load histogram:', err);
      
      errors.push(createError(
        'warning',
        'Histogram Load Error',
        'Could not load histogram data. The map will still function but temporal data may be limited.',
        { 
          recordTypes: currentRecordTypes,
          tags: currentTags,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      ));
    }
  })();
  
  // Heatmap timeline promise
  const heatmapPromise = (async () => {
    try {
      const heatmapUrl = `/api/heatmaps${currentRecordTypes.length > 0 ? `?recordTypes=${currentRecordTypes.join(',')}` : ''}${currentTags ? `${currentRecordTypes.length > 0 ? '&' : '?'}tags=${currentTags.join(',')}` : ''}` || '/api/heatmaps';
      const heatmapResponse = await fetch(heatmapUrl);
      
      if (!heatmapResponse.ok) {
        // Parse error message from SvelteKit error response
        let errorMessage = `HTTP ${heatmapResponse.status}`;
        try {
          const errorData = await heatmapResponse.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          }
        } catch {
          // Fallback to status text if JSON parsing fails
          errorMessage = heatmapResponse.statusText || errorMessage;
        }
        
        errors.push(createError(
          'warning',
          'Heatmap Load Failed',
          errorMessage,
          { recordTypes: currentRecordTypes, tags: currentTags, status: heatmapResponse.status }
        ));
      } else {
        const heatmapData = await heatmapResponse.json() as HeatmapTimelineApiResponse;
        heatmapTimeline = heatmapData;
      }
      
    } catch (err) {
      console.error('❌ Failed to load heatmap timeline:', err);
      
      errors.push(createError(
        'warning',
        'Heatmap Load Error',
        'Could not load heatmap timeline. Spatial visualization may be limited.',
        { 
          recordTypes: currentRecordTypes,
          tags: currentTags,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      ));
    }
  })();
  
  // Wait for both data requests to complete
  await Promise.all([histogramPromise, heatmapPromise]);
  
  loadingState.stopLoading(); 
  return {
    metadata,
    histogram,
    heatmapTimeline,
    currentRecordTypes,
    currentTags,
    errorData: createPageErrorData(errors)
  };
};

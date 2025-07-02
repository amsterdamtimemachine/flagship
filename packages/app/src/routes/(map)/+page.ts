// (map)/+page.ts - Load metadata, histogram, and heatmap timeline from new API with error accumulation
import type { PageLoad } from './$types';
import type { VisualizationMetadata, HistogramApiResponse, HeatmapTimelineApiResponse, RecordType } from '@atm/shared/types';
import type { AppError } from '$types/error';
import { createPageErrorData, createError, createValidationError } from '$utils/error';

interface MetadataApiResponse extends VisualizationMetadata {
  success: boolean;
  message?: string;
}

export const load: PageLoad = async ({ fetch, url }) => {
  const errors: AppError[] = [];
  let metadata: VisualizationMetadata | null = null;
  let histogram: HistogramApiResponse | null = null;
  let heatmaps: HeatmapTimelineApiResponse | null = null;
  
  // Parse URL parameters
  const recordTypeParam = url.searchParams.get('recordType') as RecordType;
  const tagsParam = url.searchParams.get('tags');
  
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
  
  // Determine recordType to use for histogram
  let currentRecordType: RecordType = 'text'; // Default fallback
  
  if (metadata?.recordTypes) {
    // Validate recordType parameter against available types
    if (recordTypeParam && metadata.recordTypes.includes(recordTypeParam)) {
      currentRecordType = recordTypeParam;
    } else {
      // Use first available recordType as default
      currentRecordType = metadata.recordTypes[0] || 'text';
      
      // Add validation error if invalid recordType was provided
      if (recordTypeParam && !metadata.recordTypes.includes(recordTypeParam)) {
        errors.push(createValidationError(
          'recordType',
          recordTypeParam,
          `Must be one of: ${metadata.recordTypes.join(', ')}`
        ));
      }
    }
  }
  
  // Parse tags if provided
  let tags: string[] | undefined;
  if (tagsParam) {
    tags = tagsParam.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0);
  }
  
  // Fetch histogram and heatmap timeline data in parallel
  const dataPromises = [];
  
  // Histogram promise
  const histogramPromise = (async () => {
    try {
      console.log(`📊 Loading histogram for recordType: ${currentRecordType}, tags: ${tags?.join(', ') || 'none'}`);
      
      const histogramUrl = `/api/histogram?recordType=${currentRecordType}${tags ? `&tags=${tags.join(',')}` : ''}`;
      const histogramResponse = await fetch(histogramUrl);
      
      if (!histogramResponse.ok) {
        errors.push(createError(
          'warning',
          'Histogram Load Failed',
          `Failed to load histogram data: HTTP ${histogramResponse.status}`,
          { recordType: currentRecordType, tags, status: histogramResponse.status }
        ));
      } else {
        const histogramData = await histogramResponse.json() as HistogramApiResponse;
        
        if (!histogramData.success) {
          errors.push(createError(
            'warning',
            'Histogram API Error',
            histogramData.message || 'Failed to get histogram data',
            { recordType: currentRecordType, tags, response: histogramData }
          ));
        } else {
          histogram = histogramData;
          
          console.log('✅ Histogram loaded successfully:', {
            recordType: currentRecordType,
            tags: tags,
            totalFeatures: histogram.histogram.totalFeatures,
            timePeriods: histogram.histogram.bins.length,
            maxCount: histogram.histogram.maxCount,
            timeRange: histogram.histogram.timeRange
          });
        }
      }
      
    } catch (err) {
      console.error('❌ Failed to load histogram:', err);
      
      errors.push(createError(
        'warning',
        'Histogram Load Error',
        'Could not load histogram data. The map will still function but temporal data may be limited.',
        { 
          recordType: currentRecordType,
          tags,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      ));
    }
  })();
  
  // Heatmap timeline promise
  const heatmapPromise = (async () => {
    try {
      console.log(`🔥 Loading heatmap timeline for recordType: ${currentRecordType}, tags: ${tags?.join(', ') || 'none'}`);
      
      const heatmapUrl = `/api/heatmaps?recordType=${currentRecordType}${tags ? `&tags=${tags.join(',')}` : ''}`;
      const heatmapResponse = await fetch(heatmapUrl);
      
      if (!heatmapResponse.ok) {
        errors.push(createError(
          'warning',
          'Heatmap Load Failed',
          `Failed to load heatmap timeline: HTTP ${heatmapResponse.status}`,
          { recordType: currentRecordType, tags, status: heatmapResponse.status }
        ));
      } else {
        const heatmapData = await heatmapResponse.json() as HeatmapTimelineApiResponse;
        
        if (!heatmapData.success) {
          errors.push(createError(
            'warning',
            'Heatmap API Error',
            heatmapData.message || 'Failed to get heatmap timeline data',
            { recordType: currentRecordType, tags, response: heatmapData }
          ));
        } else {
          heatmaps = heatmapData;
          
          const timeSliceCount = Object.keys(heatmaps.heatmapTimeline).length;
          
          // Debug: Log the actual heatmap timeline structure
          console.log('✅ Heatmap timeline loaded successfully:', {
            recordType: currentRecordType,
            tags: tags,
            resolution: heatmaps.resolution,
            timeSlices: timeSliceCount,
            timeSliceKeys: Object.keys(heatmaps.heatmapTimeline)
          });
          
          // Debug: Show complete heatmap timeline structure with data
          console.log(`\n🔍 COMPLETE HEATMAP TIMELINE for ${currentRecordType}:`);
          console.log('=====================================');
          
          for (const [timeSliceKey, timeSliceData] of Object.entries(heatmaps.heatmapTimeline)) {
            console.log(`\n📅 Time Slice: ${timeSliceKey}`);
            
            if (timeSliceData[currentRecordType]) {
              const recordData = timeSliceData[currentRecordType];
              
              // Show base heatmap data
              if (recordData.base) {
                const base = recordData.base;
                const totalFeatures = base.countarray?.reduce((sum, count) => sum + count, 0) || 0;
                const nonZeroCells = base.countarray?.filter(count => count > 0).length || 0;
                const maxCount = base.countarray ? Math.max(...base.countarray) : 0;
                
                console.log(`  📊 BASE heatmap:`, {
                  totalFeatures,
                  nonZeroCells,
                  maxCount,
                  gridSize: `${Math.sqrt(base.countarray?.length || 0)}x${Math.sqrt(base.countarray?.length || 0)}`,
                  countArray: base.countarray,
                  densityArray: base.densityarray
                });
                
                // Show grid visualization for small grids
                if (base.countarray && base.countarray.length <= 25) {
                  const gridSize = Math.sqrt(base.countarray.length);
                  console.log(`  🗺️ Grid visualization (${gridSize}x${gridSize}):`);
                  for (let row = 0; row < gridSize; row++) {
                    const rowData = [];
                    for (let col = 0; col < gridSize; col++) {
                      const index = row * gridSize + col;
                      rowData.push(base.countarray[index].toString().padStart(3, ' '));
                    }
                    console.log(`    Row ${row}: [${rowData.join(', ')}]`);
                  }
                }
              } else {
                console.log(`  ❌ No base heatmap data`);
              }
              
              // Show tag heatmaps if any
              const tagKeys = Object.keys(recordData.tags || {});
              if (tagKeys.length > 0) {
                console.log(`  🏷️ Tag heatmaps: ${tagKeys.join(', ')}`);
                for (const tag of tagKeys.slice(0, 3)) { // Show first 3 tags
                  const tagHeatmap = recordData.tags[tag];
                  const tagTotal = tagHeatmap.countarray?.reduce((sum, count) => sum + count, 0) || 0;
                  console.log(`    - ${tag}: ${tagTotal} features`);
                }
              } else {
                console.log(`  🏷️ No tag heatmaps`);
              }
            } else {
              console.log(`  ❌ No data for recordType: ${currentRecordType}`);
            }
          }
          
          console.log('\n=====================================');
        }
      }
      
    } catch (err) {
      console.error('❌ Failed to load heatmap timeline:', err);
      
      errors.push(createError(
        'warning',
        'Heatmap Load Error',
        'Could not load heatmap timeline. Spatial visualization may be limited.',
        { 
          recordType: currentRecordType,
          tags,
          error: err instanceof Error ? err.message : 'Unknown error'
        }
      ));
    }
  })();
  
  // Wait for both data requests to complete
  await Promise.all([histogramPromise, heatmapPromise]);
  
  return {
    metadata,
    histogram,
    heatmaps,
    currentRecordType,
    tags,
    errorData: createPageErrorData(errors)
  };
};

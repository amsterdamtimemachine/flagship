// src/routes/api/test/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecordType, HistogramApiResponse, TimeSlice } from '@atm/shared/types';
import type { HeatmapTimelineApiResponse } from '@atm/shared/types';

export const GET: RequestHandler = async ({ url }) => {
  const endpoint = url.searchParams.get('endpoint') || 'histogram';
  const recordTypesParam = url.searchParams.get('recordTypes') || 'text';
  const recordTypes = recordTypesParam.split(',').map(t => t.trim()) as RecordType[];
  const tags = url.searchParams.get('tags')?.split(',').filter(t => t.trim());

  console.log(`🧪 Test API called - endpoint: ${endpoint}, recordTypes: ${recordTypes.join(', ')}, tags: ${tags?.join(', ') || 'none'}`);

  if (endpoint === 'histogram') {
    // Mock histogram response
    const mockTimeSlices: TimeSlice[] = [
      {
        key: '1900_1950',
        label: '1900-1950', 
        timeRange: { start: '1900-01-01', end: '1950-12-31' },
        startYear: 1900,
        endYear: 1950,
        durationYears: 50
      },
      {
        key: '1950_2000',
        label: '1950-2000',
        timeRange: { start: '1950-01-01', end: '2000-12-31' },
        startYear: 1950,
        endYear: 2000, 
        durationYears: 50
      }
    ];

    const mockResponse: HistogramApiResponse = {
      histogram: {
        bins: [
          { timeSlice: mockTimeSlices[0], count: tags ? 25 : 150 },
          { timeSlice: mockTimeSlices[1], count: tags ? 35 : 200 }
        ],
        maxCount: tags ? 35 : 200,
        timeRange: { start: '1900-01-01', end: '2000-12-31' },
        totalFeatures: tags ? 60 : 350
      },
      recordTypes,
      tags,
      success: true,
      processingTime: 42
    };

    return json(mockResponse, {
      headers: {
        'Cache-Control': 'no-cache', // Don't cache test data
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  if (endpoint === 'heatmaps') {
    // Mock heatmap timeline response
    const mockHeatmapTimeline: any = {};
    
    // Generate mock data for each time period
    ['1900_1950', '1950_2000'].forEach(timeKey => {
      mockHeatmapTimeline[timeKey] = {};
      
      recordTypes.forEach(recordType => {
        mockHeatmapTimeline[timeKey][recordType] = {
          base: {
            countArray: Array(64).fill(0).map(() => Math.floor(Math.random() * 10)),
            densityArray: Array(64).fill(0).map(() => Math.random())
          },
          tags: tags ? {
            [tags[0]]: {
              countArray: Array(64).fill(0).map(() => Math.floor(Math.random() * 5)),
              densityArray: Array(64).fill(0).map(() => Math.random() * 0.5)
            }
          } : {}
        };
      });
    });

    const mockResponse: HeatmapTimelineApiResponse = {
      heatmapTimeline: mockHeatmapTimeline,
      recordTypes,
      tags,
      resolution: '8x8',
      success: true,
      processingTime: 28
    };

    return json(mockResponse, {
      headers: {
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }

  return json({ error: 'Invalid endpoint' }, { status: 400 });
};
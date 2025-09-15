// src/routes/api/heatmaps/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecordType, HeatmapTimelineApiResponse } from '@atm/shared/types';
import { getDataService } from '$lib/server/dataServiceSingleton';

export const GET: RequestHandler = async ({ url }) => {
	try {
		// Parse query parameters
		const recordTypesParam = url.searchParams.get('recordTypes');
		const tagsParam = url.searchParams.get('tags');
		const tagOperatorParam = url.searchParams.get('tagOperator');

		// Get API service to access metadata for defaulting
		const dataService = await getDataService();

		// Parse recordTypes - default to all available recordTypes if none specified
		let recordTypes: RecordType[];
		if (!recordTypesParam) {
			const metadata = await dataService.getVisualizationMetadata();
			recordTypes = metadata.recordTypes;
			console.log(`🔥 No recordTypes specified, defaulting to all: ${recordTypes.join(', ')}`);
		} else {
			recordTypes = recordTypesParam.split(',').map((t) => t.trim()) as RecordType[];
		}

		// Parse tags if provided
		let tags: string[] | undefined;
		if (tagsParam) {
			tags = tagsParam
				.split(',')
				.map((tag) => tag.trim())
				.filter((tag) => tag.length > 0);
		}

		console.log(
			`🔥 Heatmaps API request - recordTypes: ${recordTypes.join(', ')}, tags: ${tags?.join(', ') || 'none'}, operator: ${tagOperatorParam || 'AND'}`
		);

		let response: HeatmapTimelineApiResponse;

		// Handle OR operation by merging individual tags
		if (tagOperatorParam === 'OR' && tags && tags.length > 1) {
			console.log(`🔀 OR operation: fetching and merging individual tags`);
			
			// Import merging utilities
			const { mergeHeatmaps } = await import('$utils/heatmap');
			
			// Fetch each tag individually 
			const individualResponses = await Promise.all(
				tags.map(tag => dataService.getHeatmapTimeline(recordTypes, [tag]))
			);
			
			// Check if all individual requests succeeded
			const failedResponses = individualResponses.filter(r => !r.success);
			if (failedResponses.length > 0) {
				console.error(`❌ Some individual tag requests failed:`, failedResponses);
				response = {
					heatmapTimeline: {},
					recordTypes,
					tags,
					resolution: '',
					success: false,
					message: 'Failed to fetch some individual tags for OR operation'
				};
			} else {
				// Merge timelines by merging heatmaps for each time slice
				const timelines = individualResponses.map(r => r.heatmapTimeline);
				const mergedTimeline: any = {};
				
				// Get all unique time slice keys from all timelines
				const allTimeSliceKeys = new Set<string>();
				timelines.forEach(timeline => {
					Object.keys(timeline).forEach(key => allTimeSliceKeys.add(key));
				});
				
				// Merge each time slice
				for (const timeSliceKey of allTimeSliceKeys) {
					mergedTimeline[timeSliceKey] = {};
					
					// For each recordType, merge heatmaps from all timelines
					for (const recordType of recordTypes) {
						const heatmapsToMerge: any[] = [];
						
						// Collect heatmaps from all timelines for this time slice and record type
						timelines.forEach(timeline => {
							const timeSliceData = timeline[timeSliceKey];
							if (timeSliceData && timeSliceData[recordType] && timeSliceData[recordType].base) {
								heatmapsToMerge.push(timeSliceData[recordType].base);
							}
						});
						
						if (heatmapsToMerge.length > 0) {
							// Merge all heatmaps for this recordType and time slice
							const mergedHeatmap = mergeHeatmaps(heatmapsToMerge);
							
							// Create the merged recordType data structure
							mergedTimeline[timeSliceKey][recordType] = {
								base: mergedHeatmap,
								tags: {} // OR results don't need individual tag data
							};
						}
					}
				}
				
				response = {
					heatmapTimeline: mergedTimeline,
					recordTypes,
					tags,
					resolution: individualResponses[0].resolution,
					success: true,
					processingTime: individualResponses.reduce((sum, r) => sum + (r.processingTime || 0), 0)
				};
			}
		} else {
			// Standard AND operation or single tag
			response = await dataService.getHeatmapTimeline(recordTypes, tags);
		}

		// Set appropriate cache headers
		const headers = {
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
			'Access-Control-Allow-Origin': '*'
		};

		if (response.success) {
			const timeSliceCount = Object.keys(response.heatmapTimeline).length;
			console.log(
				`✅ Heatmaps API success - ${timeSliceCount} time periods at resolution ${response.resolution}`
			);
			return json(response, { headers });
		} else {
			console.error(`❌ Heatmaps API error: ${response.message}`);
			throw error(500, { code: 'HEATMAP_LOAD_ERROR', message: response.message || 'Failed to load heatmap data' });
		}
	} catch (err) {
		console.error('❌ Heatmaps API unexpected error:', err);
		throw error(500, { code: 'INTERNAL_ERROR', message: err instanceof Error ? err.message : 'Internal server error' });
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

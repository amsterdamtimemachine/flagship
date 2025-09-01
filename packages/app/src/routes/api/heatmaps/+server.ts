// src/routes/api/heatmaps/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecordType, HeatmapTimelineApiResponse } from '@atm/shared/types';
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
			`🔥 Heatmaps API request - recordTypes: ${recordTypes.join(', ')}, tags: ${tags?.join(', ') || 'none'}`
		);

		// Get heatmap timeline from service
		const response = await apiService.getHeatmapTimeline(recordTypes, tags);

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
			throw error(500, response.message || 'Failed to load heatmap data');
		}
	} catch (err) {
		console.error('❌ Heatmaps API unexpected error:', err);
		throw error(500, err instanceof Error ? err.message : 'Internal server error');
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

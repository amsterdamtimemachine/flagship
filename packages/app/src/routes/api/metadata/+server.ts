// src/routes/api/metadata/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDataService } from '$lib/server/dataServiceSingleton';
import type { VisualizationMetadata } from '@atm/shared/types';

interface MetadataApiResponse extends VisualizationMetadata {
	success: boolean;
	message?: string;
}

export const GET: RequestHandler = async () => {
	try {
		console.log('📋 Metadata API request');

		const dataService = await getDataService();
		const metadata = await dataService.getVisualizationMetadata();

		console.log(
			`✅ Metadata API success - ${metadata.timeSlices.length} time slices, ${metadata.recordTypes.length} record types`
		);

		return json(
			{
				...metadata,
				success: true
			},
			{
				headers: {
					'Cache-Control': 'public, max-age=86400', // Cache for 24 hours (metadata rarely changes)
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
	} catch (err) {
		console.error('❌ Metadata API error:', err);

		return json(
			{
				success: false,
				message: err instanceof Error ? err.message : 'Internal server error'
			},
			{
				status: 500,
				headers: {
					'Access-Control-Allow-Origin': '*'
				}
			}
		);
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

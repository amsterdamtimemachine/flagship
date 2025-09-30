// src/routes/api/histogram/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import type { RecordType, HistogramApiResponse } from '@atm/shared/types';
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
			console.log(`📊 No recordTypes specified, defaulting to all: ${recordTypes.join(', ')}`);
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
			`📊 Histogram API request - recordTypes: ${recordTypes.join(', ')}, tags: ${tags?.join(', ') || 'none'}, operator: ${tagOperatorParam || 'AND'}`
		);

		let response: HistogramApiResponse;

		// Handle OR operation by merging individual tags
		if (tagOperatorParam === 'OR' && tags && tags.length > 1) {
			console.log(`🔀 OR operation: fetching and merging individual histograms`);

			// Import merging utilities
			const { mergeHistograms } = await import('$utils/histogram');

			// Fetch each tag individually
			const individualResponses = await Promise.all(
				tags.map((tag) => dataService.getHistogram(recordTypes, [tag]))
			);

			// Check if all individual requests succeeded
			const failedResponses = individualResponses.filter((r) => !r.success);
			if (failedResponses.length > 0) {
				console.error(`❌ Some individual histogram requests failed:`, failedResponses);
				response = {
					histograms: {},
					recordTypes,
					tags,
					success: false,
					message: 'Failed to fetch some individual tags for OR operation'
				};
			} else {
				// Merge the individual histograms
				const mergedHistograms: any = {};

				// For each recordType, merge histograms from all individual responses
				for (const recordType of recordTypes) {
					const histogramsToMerge: any[] = [];

					// Collect histograms from all responses for this record type
					individualResponses.forEach((response) => {
						if (response.histograms[recordType] && response.histograms[recordType].base) {
							histogramsToMerge.push(response.histograms[recordType].base);
						}
					});

					if (histogramsToMerge.length > 0) {
						// Merge all histograms for this recordType
						const mergedHistogram = mergeHistograms(histogramsToMerge);

						// Create the merged recordType data structure
						mergedHistograms[recordType] = {
							base: mergedHistogram,
							tags: {} // OR results don't need individual tag data
						};
					}
				}

				response = {
					histograms: mergedHistograms,
					recordTypes,
					tags,
					success: true,
					processingTime: individualResponses.reduce((sum, r) => sum + (r.processingTime || 0), 0)
				};
			}
		} else {
			// Standard AND operation or single tag
			response = await dataService.getHistogram(recordTypes, tags);
		}

		// Set appropriate cache headers
		const headers = {
			'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
			'Access-Control-Allow-Origin': '*'
		};

		if (response.success) {
			const recordTypeCount = Object.keys(response.histograms).length;
			console.log(`✅ Histogram API success - raw data for ${recordTypeCount} recordTypes`);
			return json(response, { headers });
		} else {
			console.error(`❌ Histogram API error: ${response.message}`);
			throw error(500, {
				code: 'HISTOGRAM_LOAD_ERROR',
				message: response.message || 'Failed to load histogram data'
			});
		}
	} catch (err) {
		console.error('❌ Histogram API unexpected error:', err);
		throw error(500, {
			code: 'INTERNAL_ERROR',
			message: err instanceof Error ? err.message : 'Internal server error'
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

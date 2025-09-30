// src/lib/utils/externalApi.ts

/* The app fetches most data from SvelteKit API routes.
 * This module contains functions for fetching data directly from external APIs.
 */

import { PUBLIC_FEATURES_API_URL } from '$env/static/public';

type FetchFunction = typeof fetch;

/**
 * Fetch geodata directly from the external database API
 */
export async function fetchGeodataFromDatabase(
	params: {
		min_lat: number;
		min_lon: number;
		max_lat: number;
		max_lon: number;
		start_year: string;
		end_year: string;
		page?: number;
		recordTypes?: string[];
		tags?: string[];
		tagOperator?: 'AND' | 'OR';
		limit?: number;
	},
	fetchFn: FetchFunction = fetch
): Promise<any> {
	// Build the URL with parameters using environment variable
	const url = new URL(`${PUBLIC_FEATURES_API_URL}/geodata`);

	// Set tag_operator parameter (defaults to OR to match app behavior)
	url.searchParams.set('tag_operator', params.tagOperator || 'OR');

	// Add all parameters to the URL
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined) {
			if (key === 'recordTypes' && Array.isArray(value)) {
				// Only add recordtype if array is not empty
				if (value.length > 0) {
					url.searchParams.set('recordtype', value.join(','));
				}
			} else if (key === 'tags' && Array.isArray(value)) {
				// Only add tags if array is not empty
				if (value.length > 0) {
					url.searchParams.set('tags', value.join(','));
				}
			} else if (key === 'tagOperator') {
				// Skip - already handled above
			} else {
				url.searchParams.set(key, value.toString());
			}
		}
	});

	console.log(`🌍 Fetching geodata: ${url.toString()}`);

	try {
		const response = await fetchFn(url.toString());

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return await response.json();
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
		throw new Error(`Database API Error: ${errorMessage}`);
	}
}

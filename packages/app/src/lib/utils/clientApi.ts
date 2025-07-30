// src/lib/api.ts

/* The app fetches most of the data from the sveltekit server. 
 * This module contains functions for the few exceptions when data are fetched from the client.
*/

// import { error } from '@sveltejs/kit';
// import { loadingState } from '$state/loadingState.svelte';

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
		limit?: number;
	},
	fetchFn: FetchFunction = fetch
): Promise<any> {
	// Build the URL with parameters - switch between proxy and direct
	const url = new URL('https://atmbackend.create.humanities.uva.nl/api/geodata');
	
	// Add all parameters to the URL
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined) {
			if (key === 'recordTypes' && Array.isArray(value)) {
				url.searchParams.set('recordtype', value.join(','));
			} else if (key ==='tags' && Array.isArray(value)) {
				url.searchParams.set('tags', value.join(','));
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

/**
 * Fetch tag combinations for TagCascade component
 */
export async function fetchTagCombinations(
	params: {
		recordTypes: string[];
		selectedTags?: string[];
	},
	fetchFn: FetchFunction = fetch
) {
	try {
		const query = new URLSearchParams();
		query.set('recordTypes', params.recordTypes.join(','));
		if (params.selectedTags && params.selectedTags.length > 0) {
			query.set('selected', params.selectedTags.join(','));
		}
		
		const response = await fetchFn(`/api/tag-combinations?${query}`);
		
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}: ${response.statusText}`);
		}
		
		const data = await response.json();
		
		if (!data.success) {
			throw new Error(data.message || 'API returned unsuccessful response');
		}
		
		return data;
	} catch (error) {
		console.error('Failed to fetch tag combinations:', error);
		throw error;
	}
}

// src/lib/api.ts

import { error } from '@sveltejs/kit';
import { loadingStore } from '$stores/loadingStore.svelte';

type FetchFunction = typeof fetch;

export async function fetchApi<T>(endpoint: string, fetchFn: FetchFunction = fetch): Promise<T> {
	loadingStore.startLoading();

	try {
		const response = await fetchFn(endpoint);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return (await response.json()) as T;
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
		error(500, { message: errorMessage, code: 'API_ERROR' });
	} finally {
		loadingStore.stopLoading();
	}
}

export async function postApi<T>(endpoint: string, data?: any, options?: RequestInit): Promise<T> {
	const defaultOptions: RequestInit = {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json'
		},
		body: data ? JSON.stringify(data) : undefined
	};

	const mergedOptions = { ...defaultOptions, ...options };

	try {
		const response = await fetch(endpoint, mergedOptions);
		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}

		return (await response.json()) as T;
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
		throw new Error(`API Error: ${errorMessage}`);
	}
}

// API functions for visualization data
import type { 
	RecordType, 
	HistogramApiResponse, 
	VisualizationMetadata 
} from '@atm/shared/types';
import type { HeatmapTimelineApiResponse } from '$lib/server/api-service';

/**
 * Fetch histogram data for a specific recordType and optional tags
 */
export async function fetchHistogram(
	recordType: RecordType,
	tags?: string[],
	fetchFn: FetchFunction = fetch
): Promise<HistogramApiResponse> {
	// Build the URL with parameters
	const url = new URL('/api/histogram', window.location.origin);
	url.searchParams.set('recordType', recordType);
	
	if (tags && tags.length > 0) {
		url.searchParams.set('tags', tags.join(','));
	}

	console.log(`📊 Fetching histogram: ${url.toString()}`);
	return fetchApi<HistogramApiResponse>(url.toString(), fetchFn);
}

/**
 * Fetch heatmap timeline for a specific recordType and optional tags
 * Returns all time periods at single resolution
 */
export async function fetchHeatmapTimeline(
	recordType: RecordType,
	tags?: string[],
	fetchFn: FetchFunction = fetch
): Promise<HeatmapTimelineApiResponse> {
	// Build the URL with parameters
	const url = new URL('/api/heatmaps', window.location.origin);
	url.searchParams.set('recordType', recordType);
	
	if (tags && tags.length > 0) {
		url.searchParams.set('tags', tags.join(','));
	}

	console.log(`🔥 Fetching heatmap timeline: ${url.toString()}`);
	return fetchApi<HeatmapTimelineApiResponse>(url.toString(), fetchFn);
}

/**
 * Fetch visualization metadata (timeSlices, recordTypes, tags, etc.)
 */
export async function fetchVisualizationMetadata(
	fetchFn: FetchFunction = fetch
): Promise<VisualizationMetadata & { success: boolean }> {
	console.log('📋 Fetching visualization metadata');
	return fetchApi<VisualizationMetadata & { success: boolean }>('/api/metadata', fetchFn);
}

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
		recordType?: string;
		limit?: number;
	},
	fetchFn: FetchFunction = fetch
): Promise<any> {
	// Build the URL with parameters - switch between proxy and direct
	const url = new URL('https://atmbackend.create.humanities.uva.nl/api/geodata');
	
	// Add all parameters to the URL
	Object.entries(params).forEach(([key, value]) => {
		if (value !== undefined) {
			url.searchParams.set(key, value.toString());
		}
	});

	console.log(`🌍 Fetching geodata via proxy: ${url.toString()}`);
	
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

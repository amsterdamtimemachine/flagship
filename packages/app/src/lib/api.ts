// src/lib/api.ts

import { error } from '@sveltejs/kit';
import { loadingStore } from '$lib/stores/loadingStore';

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

// $api.ts
//import type { HeatmapsResponse, ContentClass } from '@atm/shared-types';
//import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';
//
//// New fetchHeatmaps function that uses your existing fetchApi
//export async function fetchHeatmaps(
//	selectedClasses: Set<ContentClass> | ContentClass[],
//	selectedTags: Set<string> | string[],
//	fetchFn: FetchFunction = fetch
//): Promise<HeatmapsResponse> {
//	const baseUrl =
//		import.meta.env.MODE === 'production' ? PUBLIC_SERVER_PROD_URL : PUBLIC_SERVER_DEV_URL;
//
//	// Convert collections to arrays if needed
//	const classesArray = Array.isArray(selectedClasses)
//		? selectedClasses
//		: Array.from(selectedClasses);
//
//	const tagsArray = Array.isArray(selectedTags) ? selectedTags : Array.from(selectedTags);
//
//	// Build the URL with parameters
//	const classesParam = classesArray.join(',');
//	const tagsParam = tagsArray.join(',');
//
//	let heatmapsUrl = `${baseUrl}/grid/heatmaps`;
//
//	// Add query parameters only if they're not empty
//	const params = [];
//	if (classesParam) params.push(`contentClasses=${classesParam}`);
//	if (tagsParam) params.push(`tags=${tagsParam}`);
//	if (params.length > 0) {
//		heatmapsUrl += `?${params.join('&')}`;
//	}
//	console.log(heatmapsUrl);
//
//	// Use your existing fetchApi function
//	return fetchApi<HeatmapsResponse>(heatmapsUrl, fetchFn);
//}

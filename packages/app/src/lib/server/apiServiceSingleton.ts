// src/lib/server/apiServiceSingleton.ts
import { VisualizationApiService } from './apiService.js';

// Get binary path from environment

import { PRIVATE_VISUALIZATION_BINARY_PATH } from '$env/static/private';

if (!PRIVATE_VISUALIZATION_BINARY_PATH) {
	throw new Error('VISUALIZATION_BINARY_PATH environment variable is required');
}

// Create singleton instance
export const apiService = new VisualizationApiService(PRIVATE_VISUALIZATION_BINARY_PATH);

// Initialize the service once
let initPromise: Promise<void> | null = null;

export async function getApiService(): Promise<VisualizationApiService> {
	if (!initPromise) {
		initPromise = apiService.initialize();
	}

	await initPromise;
	return apiService;
}

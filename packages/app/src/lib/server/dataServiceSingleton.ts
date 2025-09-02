// src/lib/server/dataServiceSingleton.ts
import { VisualizationDataService } from './dataService.js';

// Get binary path from environment

import { PRIVATE_VISUALIZATION_BINARY_PATH } from '$env/static/private';

if (!PRIVATE_VISUALIZATION_BINARY_PATH) {
	throw new Error('VISUALIZATION_BINARY_PATH environment variable is required');
}

// Create singleton instance
export const dataService = new VisualizationDataService(PRIVATE_VISUALIZATION_BINARY_PATH);

// Initialize the service once
let initPromise: Promise<void> | null = null;

export async function getDataService(): Promise<VisualizationDataService> {
	if (!initPromise) {
		initPromise = dataService.initialize();
	}

	await initPromise;
	return dataService;
}

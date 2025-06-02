// state/MapController.svelte.ts

import { browser } from '$app/environment';
import { page } from '$app/state';
import { replaceState } from '$app/navigation';
import { fetchApi } from '$api';
import { createCellNotFoundError, createCellLoadError, createEmptyCellError } from '$utils/error';
import type { CellFeaturesResponse } from '@atm/shared-types';
import type { AppError } from '$types/error';
import {
	PUBLIC_SERVER_DEV_URL,
	PUBLIC_SERVER_PROD_URL
} from '$env/static/public';

interface CellData {
	cellFeatures: CellFeaturesResponse;
}

/**
 * Creates a centralized controller for managing map state, URL synchronization, 
 * and cell data loading. This handles the coordination between user interactions,
 * URL parameters, and server data.
 */
export function createMapController() {
	// Core reactive state
	let currentPeriod = $state<string>('');
	let selectedCellId = $state<string | null>(null);
	let cellData = $state<CellData | null>(null);
	let isLoadingCell = $state(false);
	let isRouterReady = $state(false);
	let errors = $state<AppError[]>([]);

	const baseUrl = import.meta.env.MODE === 'production' 
		? PUBLIC_SERVER_PROD_URL 
		: PUBLIC_SERVER_DEV_URL;

	/**
	 * Initializes the controller with server data and syncs with URL parameters.
	 * Should be called once in onMount with data from the load function.
	 */
	function initialize(serverPeriod: string) {
		currentPeriod = serverPeriod;
		isRouterReady = true;
		
		if (browser) {
			// Check if cell should be opened from URL parameters
			const cellParam = page.url.searchParams.get('cell');
			if (cellParam) {
				selectCell(cellParam);
			}
		}
	}

	/**
	 * Updates the current time period and syncs to URL.
	 * This is typically called from the time period slider.
	 */
	function setPeriod(newPeriod: string) {
		currentPeriod = newPeriod;
		updateUrlParams({ period: newPeriod });
		
		// If a cell is currently selected, reload its data for the new period
		if (cellData) {
			loadCellData(cellData.cellFeatures.cellId, newPeriod);
		}
	}

	/**
	 * Selects a cell and loads its data. Updates URL to reflect selection.
	 * Pass null to deselect the current cell.
	 */
	async function selectCell(cellId: string | null) {
		if (cellId) {
			selectedCellId = cellId;
			updateUrlParams({ cell: cellId });
			await loadCellData(cellId, currentPeriod);
			
			// Only deselect if loading completely failed (no cellData at all)
			if (!cellData) {
				selectedCellId = null;
				updateUrlParams({ cell: null });
			}
		} else {
			selectedCellId = null;
			updateUrlParams({ cell: null });
			cellData = null;
		}
	}

	/**
	 * Loads cell data from the API for the given cell and period.
	 * Automatically includes current filter parameters from URL.
	 * Handles errors gracefully without breaking the app.
	 */
	async function loadCellData(cellId: string, period: string) {
		if (!browser) return;
		
		isLoadingCell = true;
		cellData = null; // Clear existing data while loading
		
		try {
			// Build API URL with current filters
			const contentClasses = page.url.searchParams.get('contentClasses') || '';
			const tags = page.url.searchParams.get('tags') || '';
			
			let apiUrl = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=1`;
			if (contentClasses) apiUrl += `&contentClasses=${contentClasses}`;
			if (tags) apiUrl += `&tags=${tags}`;
			
			console.log('Loading cell data for:', cellId, 'URL:', apiUrl); // Debug log
			
			const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl);
			
			// Always set cellData - whether cell has content or not
			cellData = { cellFeatures };
			console.log('Cell data loaded successfully:', $state.snapshot(cellData)); // Debug log using snapshot
			
		} catch (error: any) {
			console.error('Error loading cell data:', error);
			cellData = null; // No modal for non-existent cells
			
			// Create appropriate error based on response
			let cellError: AppError;
			if (error?.status === 404) {
				console.log('Creating 404 error for cell:', cellId); // Debug log
				cellError = createCellNotFoundError(cellId, period);
			} else {
				const reason = error?.message || 'Network error';
				console.log('Creating general error for cell:', cellId, 'reason:', reason); // Debug log
				cellError = createCellLoadError(cellId, period, reason);
			}
			
			// Add error to the errors array for ErrorHandler
			console.log('Adding error to errors array:', cellError); // Debug log
			errors = [...errors, cellError];
			
		} finally {
			isLoadingCell = false;
		}
	}

	/**
	 * Clears all current errors. Useful when navigating or retrying operations.
	 */
	function clearErrors() {
		errors = [];
	}

	/**
	 * Updates URL parameters without triggering navigation.
	 * Maintains current page state while updating the address bar.
	 * Guards against calling before router is initialized.
	 */
	function updateUrlParams(params: Record<string, string | null>) {
		if (!browser || !isRouterReady) return;
		
		try {
			const url = new URL(window.location.href);
			
			Object.entries(params).forEach(([key, value]) => {
				if (value) {
					url.searchParams.set(key, value);
				} else {
					url.searchParams.delete(key);
				}
			});
			
			replaceState(url.pathname + url.search, page.state);
		} catch (error) {
			// Router not initialized yet, skip URL update
			console.debug('Router not ready, skipping URL update:', error);
		}
	}

	// Public interface - expose only what components need
	return {
		// State getters (reactive)
		get currentPeriod() { return currentPeriod; },
		get selectedCellId() { return selectedCellId; },
		get cellData() { return cellData; },
		get isLoadingCell() { return isLoadingCell; },
		get showCellModal() { return !!cellData; },
		get errors() { return errors; },

		// Control methods
		initialize,
		setPeriod,
		selectCell,
		clearErrors
	};
}

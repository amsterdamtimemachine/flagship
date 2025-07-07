// state/MapController.svelte.ts

import { browser } from '$app/environment';
import { page } from '$app/state';
import { replaceState } from '$app/navigation';
import { loadingState } from '$state/loadingState.svelte';
import { fetchGeodataFromDatabase } from '$api';
import { createCellNotFoundError, createCellLoadError, createEmptyCellError } from '$utils/error';
import type { AppError } from '$types/error';

interface CellData {
	geodata: any; // Database API response
	cellId: string;
	period: string;
	bounds?: { minlat: number; maxlat: number; minlon: number; maxlon: number };
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
	let isRouterReady = $state(false);
	let errors = $state<AppError[]>([]);

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
			loadCellData(cellData.cellId, newPeriod, cellData.bounds);
		}
	}

	/**
	 * Selects a cell and loads its data. Updates URL to reflect selection.
	 * Pass null to deselect the current cell.
	 */
	async function selectCell(cellId: string | null, bounds?: { minlat: number; maxlat: number; minlon: number; maxlon: number }) {
		if (cellId) {
			selectedCellId = cellId;
			updateUrlParams({ cell: cellId });
			await loadCellData(cellId, currentPeriod, bounds);
			
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
	 * Loads cell data from the database API for the given cell and period.
	 * Fetches geodata directly from the external API using cell bounds.
	 * Handles errors gracefully without breaking the app.
	 */
	async function loadCellData(cellId: string, period: string, bounds?: { minlat: number; maxlat: number; minlon: number; maxlon: number }) {
		if (!browser) return;
		
		loadingState.startLoading();
		cellData = null; // Clear existing data while loading
		
		try {
			// Parse period to get start and end years
			const [startYear, endYear] = period.split('_').map(y => parseInt(y));
			
			// Use cell bounds if provided, otherwise fall back to broad bounds
			const params = {
				min_lat: bounds?.minlat ?? 1,
				min_lon: bounds?.minlon ?? 1,
				max_lat: bounds?.maxlat ?? 85,
				max_lon: bounds?.maxlon ?? 55,
				start_year: `${startYear}-01-01`,
				end_year: `${endYear}-01-01`,
				page: 1
			};
			
			console.log('Loading geodata for cell:', cellId, 'period:', period, 'params:', params);
			
			const geodata = await fetchGeodataFromDatabase(params);
			
			// Always set cellData - whether cell has content or not
			cellData = { 
				geodata,
				cellId,
				period,
				bounds
			};
			console.log('Geodata loaded successfully:', $state.snapshot(cellData));
			
		} catch (error: any) {
			console.error('Error loading geodata:', error);
			cellData = null; // No modal for non-existent cells
			
			// Create appropriate error based on response
			let cellError: AppError;
			if (error?.message?.includes('404')) {
				console.log('Creating 404 error for cell:', cellId);
				cellError = createCellNotFoundError(cellId, period);
			} else {
				const reason = error?.message || 'Network error';
				console.log('Creating general error for cell:', cellId, 'reason:', reason);
				cellError = createCellLoadError(cellId, period, reason);
			}
			
			// Add error to the errors array for ErrorHandler
			console.log('Adding error to errors array:', cellError);
			errors = [...errors, cellError];
			
		} finally {
			loadingState.stopLoading();
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
		get showCellModal() { return !!cellData; },
		get errors() { return errors; },

		// Control methods
		initialize,
		setPeriod,
		selectCell,
		clearErrors
	};
}

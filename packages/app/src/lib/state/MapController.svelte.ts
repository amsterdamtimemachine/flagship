// state/MapController.svelte.ts

import { browser } from '$app/environment';
import { page } from '$app/state';
import { replaceState, goto } from '$app/navigation';
import type { AppError } from '$types/error';

/**
 * Creates a centralized controller for managing map state, URL synchronization, 
 * and cell data loading. This handles the coordination between user interactions,
 * URL parameters, and server data.
 */
export function createMapController() {
	// Core reactive state
	let currentPeriod = $state<string>('');
	let selectedCellId = $state<string | null>(null);
	let selectedCellBounds = $state<{ minLat: number; maxLat: number; minLon: number; maxLon: number } | null>(null);
	let errors = $state<AppError[]>([]);
	
	// Callback for cell selection
	let onCellSelected = $state<((cellId: string | null, bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => void) | null>(null);

	/**
	 * Initializes the controller with server data.
	 * Should be called once in onMount with data from the load function.
	 */
	function initialize(serverPeriod: string) {
		currentPeriod = serverPeriod;
	}

	/**
	 * Updates the current time period and syncs to URL.
	 * This is typically called from the time period slider.
	 */
	function setPeriod(newPeriod: string) {
		currentPeriod = newPeriod;
		updateUrlParams({ period: newPeriod });
		
		// Note: Cell data reloading is now handled by CellView component
		// when it detects period prop changes via $effect()
	}

	function setRecordType(newRecordTypes: string[]) {
		if (!browser) return;
		
		const url = new URL(window.location.href)		
		// Update recordTypes parameter
		if (newRecordTypes.length > 0) {
			url.searchParams.set('recordTypes', newRecordTypes.join(','));
		} else {
			url.searchParams.delete('recordTypes');
		}
	
		// Navigate to new URL to trigger data refetch
		goto(url.pathname + url.search);
	}

	function setTags(newTags: string[]) {
		// Placeholder function for tags filtering
		// TODO: Implement tags URL parameter handling and navigation
		console.log('Tags changed:', newTags);
	}

	/**
	 * Syncs URL parameters with current state after navigation is complete.
	 * Should be called from afterNavigate hook in page component.
	 */
	function syncUrlParameters(serverPeriod: string) {
		if (!browser) return;
		
		// Set period to URL if not already present
		const urlPeriod = page.url.searchParams.get('period');
		if (!urlPeriod) {
			updateUrlParams({ period: serverPeriod });
		}
		
		// Check if cell should be opened from URL parameters
		const cellParam = page.url.searchParams.get('cell');
		if (cellParam) {
			selectCell(cellParam);
		}
	}

	/**
	 * Selects a cell and updates URL. Calls onCellSelected callback.
	 * Pass null to deselect the current cell.
	 */
	function selectCell(cellId: string | null, bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }) {
		selectedCellId = cellId;
		selectedCellBounds = bounds || null;
		
		if (cellId) {
			updateUrlParams({ cell: cellId });
		} else {
			updateUrlParams({ cell: null });
		}
		
		// Call callback if provided
		if (onCellSelected) {
			onCellSelected(cellId, bounds);
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
		if (!browser) return;
		
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
		get selectedCellBounds() { return selectedCellBounds; },
		get showCellModal() { return !!selectedCellId; },
		get errors() { return errors; },

		// Control methods
		initialize,
		setPeriod,
		setRecordType,
		setTags,
		syncUrlParameters,
		selectCell,
		clearErrors,
		
		// Callback setters
		set onCellSelected(callback: ((cellId: string | null, bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => void) | null) {
			onCellSelected = callback;
		}
	};
}

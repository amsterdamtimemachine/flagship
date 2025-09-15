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
	let selectedCellBounds = $state<{
		minLat: number;
		maxLat: number;
		minLon: number;
		maxLon: number;
	} | null>(null);
	let errors = $state<AppError[]>([]);

	// Callback for cell selection
	let onCellSelected = $state<
		| ((
				cellId: string | null,
				bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
		  ) => void)
		| null
	>(null);

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

		// note period change affects only individual cell, hence this fn doesn't trigger goto
		// cell data are fetched in $components/FeaturesPanel.svelte
	}

	function setRecordType(newRecordTypes: string[], options: { resetTags?: boolean } = {}) {
		if (!browser) return;

		const url = new URL(window.location.href);
		// Update recordTypes parameter
		if (newRecordTypes.length > 0) {
			url.searchParams.set('recordTypes', newRecordTypes.join(','));
		} else {
			url.searchParams.delete('recordTypes');
		}

		if (options.resetTags) {
			console.log('resettting tags!');
			url.searchParams.delete('tags');
		}

		// Navigate to new URL to trigger data refetch
		goto(url.pathname + url.search);
	}

	function setTags(newTags: string[]) {
		if (!browser) return;

		const url = new URL(window.location.href);

		// Update tags parameter
		if (newTags.length > 0) {
			url.searchParams.set('tags', newTags.join(','));
		} else {
			url.searchParams.delete('tags');
		}
		// Navigate to new URL to trigger data refetch
		goto(url.pathname + url.search);
	}

	function setTagOperator(operator: 'AND' | 'OR') {
		if (!browser) return;

		const url = new URL(window.location.href);
		url.searchParams.set('tagOperator', operator);
		// Navigate to new URL to trigger data refetch
		goto(url.pathname + url.search);
	}

	/**
	 * Syncs URL parameters with current state after navigation is complete.
	 */
	function syncUrlParameters(serverPeriod: string, serverTagOperator: string = 'OR') {
		if (!browser) return;

		// Set period to URL if not already present
		const urlPeriod = page.url.searchParams.get('period');
		if (!urlPeriod) {
			updateUrlParams({ period: serverPeriod });
		}

		// Set tagOperator to URL if not already present
		const urlTagOperator = page.url.searchParams.get('tagOperator');
		if (!urlTagOperator) {
			updateUrlParams({ tagOperator: serverTagOperator });
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
	function selectCell(
		cellId: string | null,
		bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
	) {
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
		get currentPeriod() {
			return currentPeriod;
		},
		get selectedCellId() {
			return selectedCellId;
		},
		get selectedCellBounds() {
			return selectedCellBounds;
		},
		get showCellModal() {
			return !!selectedCellId;
		},
		get errors() {
			return errors;
		},

		// Control methods
		initialize,
		setPeriod,
		setRecordType,
		setTags,
		setTagOperator,
		syncUrlParameters,
		selectCell,
		clearErrors,

		// Callback setters
		set onCellSelected(
			callback:
				| ((
						cellId: string | null,
						bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }
				  ) => void)
				| null
		) {
			onCellSelected = callback;
		}
	};
}

import { browser } from '$app/environment';
import { page } from '$app/state';
import { goto, pushState, replaceState } from '$app/navigation';
import { fetchHeatmaps, fetchApi } from '$api';
import type { ContentClass, Heatmap, CellFeaturesResponse } from '@atm/shared-types';
import {
	PUBLIC_DEFAULT_CONTENT_CLASS,
	PUBLIC_SERVER_PROD_URL,
	PUBLIC_SERVER_DEV_URL
} from '$env/static/public';

export function createMapController() {
	// Core state - minimal state needed for controller functions
	let selectedClasses = $state(new Set<ContentClass>([PUBLIC_DEFAULT_CONTENT_CLASS]));
	let selectedTags = $state(new Set<string>());
	let currentPeriod = $state<string | undefined>(undefined);
	let isLoading = $state(false);
	let isLoadingNewPeriod = $state(false);

	// Helper function to build URL paths
	function buildCellRoute(cellId: string, period: string): string {
		let cellRoute = `/cells/${period}/${cellId}`;

		const params = new URLSearchParams();
		if (selectedClasses.size > 0) {
			params.set('contentClasses', Array.from(selectedClasses).join(','));
		}
		if (selectedTags.size > 0) {
			params.set('tags', Array.from(selectedTags).join(','));
		}

		const queryString = params.toString();
		if (queryString) {
			cellRoute += `?${queryString}`;
		}

		return cellRoute;
	}

	function buildCellApiUrl(cellId: string, period: string): string {
		const baseUrl =
			import.meta.env.MODE === 'production' ? PUBLIC_SERVER_PROD_URL : PUBLIC_SERVER_DEV_URL;

		let apiUrl = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=1`;

		if (selectedClasses.size > 0) {
			const classesString = Array.from(selectedClasses).join(',');
			apiUrl += `&contentClasses=${classesString}`;
		}

		if (selectedTags.size > 0) {
			const tagsString = Array.from(selectedTags).join(',');
			apiUrl += `&tags=${tagsString}`;
		}

		return apiUrl;
	}

	async function initialize(timePeriods: string[] | undefined, initialPeriod?: string): Promise<void> {
		if (browser) {
			// Get parameters from URL if present
			const contentClassesParam = page.url.searchParams.get('contentClasses');
			const tagsParam = page.url.searchParams.get('tags');
			const periodParam = page.url.searchParams.get('period');

			// Initialize selected classes from URL or default
			if (contentClassesParam) {
				selectedClasses = new Set(contentClassesParam.split(',') as ContentClass[]);
			} else if (PUBLIC_DEFAULT_CONTENT_CLASS) {
				selectedClasses = new Set([PUBLIC_DEFAULT_CONTENT_CLASS]);
			}

			// Initialize selected tags from URL
			if (tagsParam) {
				selectedTags = new Set(tagsParam.split(','));
			}

			// Set initial period - priority: initialPeriod > URL param > first period
			if (initialPeriod && timePeriods && timePeriods.includes(initialPeriod)) {
				currentPeriod = initialPeriod;
			} else if (periodParam && timePeriods && timePeriods.includes(periodParam)) {
				currentPeriod = periodParam;
			} else if (timePeriods && timePeriods.length > 0) {
				currentPeriod = timePeriods[0];
			}

			console.log('MapController initialized with:', {
				selectedClasses: Array.from(selectedClasses),
				selectedTags: Array.from(selectedTags),
				currentPeriod,
				source: initialPeriod ? 'route-param' : periodParam ? 'url-param' : 'default'
			});
		}
	}

	function syncUrlParams(): void {
		if (!browser) return;

		// Get parameters from current URL
		const contentClassesParam = page.url.searchParams.get('contentClasses');
		const tagsParam = page.url.searchParams.get('tags');

		// Update selected classes from URL
		if (contentClassesParam) {
			selectedClasses = new Set(contentClassesParam.split(',') as ContentClass[]);
		} else if (PUBLIC_DEFAULT_CONTENT_CLASS) {
			selectedClasses = new Set([PUBLIC_DEFAULT_CONTENT_CLASS]);
		} else {
			selectedClasses = new Set();
		}

		// Update selected tags from URL
		if (tagsParam) {
			selectedTags = new Set(tagsParam.split(','));
		} else {
			selectedTags = new Set();
		}

		console.log('Synced URL params:', {
			selectedClasses: Array.from(selectedClasses),
			selectedTags: Array.from(selectedTags)
		});
	}

	// Get selected classes as array
	function getSelectedClassesArray(): ContentClass[] {
		return Array.from(selectedClasses);
	}

	// Get selected tags as array
	function getSelectedTagsArray(): string[] {
		return Array.from(selectedTags);
	}

	// Get the currently selected cell ID
	function getSelectedCellId(): string | undefined {
		return page.state.selectedCell?.cellFeatures.cellId;
	}

	// Get current period
	function getCurrentPeriod(): string | undefined {
		return currentPeriod;
	}

	// Handler for class selection changes
	function handleClassesChange(classes: ContentClass[]): void {
		selectedClasses = new Set(classes);
	}

	// Handler for tag selection changes
	function handleTagsChange(tags: string[]): void {
		selectedTags = new Set(tags);
	}

	function updatePeriod(period: string | undefined): void {
		currentPeriod = period;
		
		if (!browser) return;
		
		if (period) {
			const url = new URL(window.location.href);
			const newPath = `/${period}`;
			goto(newPath + url.search, page.state);
		}
	}

	function setPeriod(period: string | undefined): void {
		currentPeriod = period;
	}

	// Handle cell selection
	async function selectCell(cellId: string | null): Promise<void> {
		// if (cellId === null || !currentPeriod) {
		//   pushState('/', {
		//     selectedCell: undefined
		//   });
		//   return;
		// }
		// const cellRoute = buildCellRoute(cellId, currentPeriod);
		// const apiUrl = buildCellApiUrl(cellId, currentPeriod);
		// try {
		//   isLoading = true;
		//   // Fetch cell data
		//   const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl);
		//   // Navigate with both URL parameters and state
		//   pushState(cellRoute, {
		//     selectedCell: { cellFeatures }
		//   });
		// } catch (error) {
		//   console.error('Error fetching cell data:', error);
		// } finally {
		//   isLoading = false;
		// }
	}

	function updateUrlParams(): void {
		if (!browser) return;

		const url = new URL(window.location.href);
		
		if (selectedClasses.size > 0) {
			url.searchParams.set('contentClasses', Array.from(selectedClasses).join(','));
		} else {
			url.searchParams.delete('contentClasses');
		}

		if (selectedTags.size > 0) {
			url.searchParams.set('tags', Array.from(selectedTags).join(','));
		} else {
			url.searchParams.delete('tags');
		}

		replaceState(url.pathname + url.search, page.state);
	}

	// Update selected cell with new filters
	async function updateCellWithFilters(): Promise<void> {
		//  if (!browser || !page.state.selectedCell) return;
		//  // Get the currently selected cell ID and period
		//  const cellId = page.state.selectedCell.cellFeatures.cellId;
		//  if (!cellId || !currentPeriod) return;
		//  const cellRoute = buildCellRoute(cellId, currentPeriod);
		//  const apiUrl = buildCellApiUrl(cellId, currentPeriod);
		//  try {
		//    isLoading = true;
		//    // Fetch updated cell data
		//    const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl);
		//    // Update the route and state
		//    pushState(cellRoute, {
		//      selectedCell: { cellFeatures }
		//    });
		//  } catch (error) {
		//    console.error('Error updating cell for new content classes:', error);
		//  } finally {
		//    isLoading = false;
		//  }
	}

	// Update selected cell with new period
	async function updateCellWithPeriod(): Promise<void> {
		//  if (!browser || !page.state.selectedCell || !currentPeriod) return;
		//  isLoadingNewPeriod = true;
		//  // Get the currently selected cell ID
		//  const cellId = page.state.selectedCell.cellFeatures.cellId;
		//  if (!cellId) return;
		//  const cellRoute = buildCellRoute(cellId, currentPeriod);
		//  const apiUrl = buildCellApiUrl(cellId, currentPeriod);
		//  try {
		//    // Fetch and update
		//    const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl);
		//    // Update the route and state
		//    pushState(cellRoute, {
		//      selectedCell: { cellFeatures }
		//    });
		//  } catch (error) {
		//    console.error('Error updating cell for new period:', error);
		//  } finally {
		//    isLoadingNewPeriod = false;
		//  }
	}

	// Return public interface - only expose control methods
	return {
		// State getters
		getSelectedClassesArray,
		getSelectedTagsArray,
		getSelectedCellId,
		getCurrentPeriod,

		// State for UI feedback
		get isLoading() {
			return isLoading;
		},
		get isLoadingNewPeriod() {
			return isLoadingNewPeriod;
		},
		// Control methods
		initialize,
		handleClassesChange,
		handleTagsChange,
		updatePeriod,
		setPeriod,
		selectCell,
		updateUrlParams,
		syncUrlParams,
		updateCellWithFilters,
		updateCellWithPeriod
	};
}

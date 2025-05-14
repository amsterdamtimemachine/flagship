<script lang="ts">
	import type { ContentClass, Heatmap } from '@atm/shared-types';
	import { onMount } from 'svelte';
	import { preloadData, pushState } from '$app/navigation';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import {
		PUBLIC_DEFAULT_CONTENT_CLASS,
		PUBLIC_SERVER_PROD_URL,
		PUBLIC_SERVER_DEV_URL
	} from '$env/static/public';

	import { fetchHeatmaps, fetchApi } from '$api';
	import CellPage from '$routes/(map)/cells/[period]/[cellId]/+page.svelte';
	import ToggleGroupSelector from '$components/ToggleGroupSelector.svelte';
	import MapGLGrid from '$components/MapGLGrid.svelte';
	import HeatmapSlider from '$components/HeatmapSlider.svelte';

	let { data } = $props();

	let currentPeriod = $state(undefined);
	let selectedClasses = $state(new Set<ContentClass>([PUBLIC_DEFAULT_CONTENT_CLASS]));
	let selectedTags = $state(new Set<string>());
	let isLoading = $state(false);
	let loadingNewPeriod = $state(false);

	let dimensions = $derived(data?.metadata?.dimensions);
	let heatmaps = $derived(data?.heatmaps?.heatmaps as Record<string, Heatmap>);
	let heatmapBlueprint = $derived(data?.metadata?.heatmapBlueprint?.cells);
	let featuresStatistics = $derived(data?.metadata?.featuresStatistics);
	let timePeriods = $derived(data?.metadata?.timePeriods);

	// Track previous selections to detect changes
	let previousSelectedClasses = $state(new Set(selectedClasses));
	let previousSelectedTags = $state(new Set(selectedTags));
	let previousPeriod = $state(currentPeriod);

	// Helper function to compare sets
	function hasSelectionChanged(current: Set<any>, previous: Set<any>): boolean {
		if (current.size !== previous.size) return true;
		
		for (const item of current) {
			if (!previous.has(item)) return true;
		}
		
		return false;
	}

	// Function that uses the modular fetchHeatmaps
	async function updateHeatmaps() {
		isLoading = true;

		try {
			const response = await fetchHeatmaps(selectedClasses, selectedTags);
			data.heatmaps = response;
		} catch (error) {
			console.error('Error fetching heatmaps:', error);
		} finally {
			isLoading = false;
		}
	}

	async function handleCellClick(event: CustomEvent) {
		const { id } = event.detail;

		// If id is null, clear the selection
		if (id === null) {
			pushState('/', {
				selectedCell: undefined
			});
			return;
		}

		const period = currentPeriod;
		let cellRoute = `/cells/${period}/${id}`;
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
		const baseUrl =
			import.meta.env.MODE === 'production' ? PUBLIC_SERVER_PROD_URL : PUBLIC_SERVER_DEV_URL;

		let apiUrl = `${baseUrl}/grid/cell/${id}?period=${period}&page=1`;
		if (params.has('contentClasses')) apiUrl += `&contentClasses=${params.get('contentClasses')}`;
		if (params.has('tags')) apiUrl += `&tags=${params.get('tags')}`;

		try {
			// Fetch cell data directly
			const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl);

			console.log(cellFeatures);

			// Navigate with both URL parameters and state
			pushState(cellRoute, {
				selectedCell: { cellFeatures }
			});
		} catch (error) {
			console.error('Error fetching cell data:', error);
		}
	}

	function handleClassesChange(classes: ContentClass[]) {
		selectedClasses = new Set(classes);
	}
	
	function handleTagsChange(tags: string[]) {
		selectedTags = new Set(tags);
	}

	onMount(() => {
		// Get parameters from URL if present
		const contentClassesParam = $page.url.searchParams.get('contentClasses');
		const tagsParam = $page.url.searchParams.get('tags');

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

		// Update heatmap with initial selections
		updateHeatmaps();
	});

	// Effect to watch for changes in selectedClasses and fetch new data
	$effect(() => {
		if (selectedClasses.size > 0) {
			console.log('Selection changed, fetching new heatmaps...');
			updateHeatmaps();
		}
		
		previousSelectedClasses = new Set(selectedClasses);
		previousSelectedTags = new Set(selectedTags);
	});

	// Effect to update URL when selections change
	$effect(() => {
		if (browser && (selectedClasses.size > 0 || selectedTags.size > 0)) {
			const url = new URL(window.location.href);

			// Update URL parameters without triggering navigation
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

			console.log("triggering history");

			// Update browser history without full page reload
			history.replaceState({}, '', url.toString());
		}
	});

	// Effect to update the cell when content classes or tags change
	$effect(() => {
		if (browser && $page.state.selectedCell && 
			(hasSelectionChanged(selectedClasses, previousSelectedClasses) || 
			hasSelectionChanged(selectedTags, previousSelectedTags))) {
			
			// Get the currently selected cell ID and period
			const cellId = $page.state.selectedCell.cellFeatures.cellId;
			const period = currentPeriod;

			// Build new cell route with the current period
			let cellRoute = `/cells/${period}/${cellId}`;

			// Add query parameters
			const params = new URLSearchParams();

			if (selectedClasses.size > 0) {
				params.set('contentClasses', Array.from(selectedClasses).join(','));
			}

			if (selectedTags.size > 0) {
				params.set('tags', Array.from(selectedTags).join(','));
			}

			// Add search params if we have any
			const queryString = params.toString();
			if (queryString) {
				cellRoute += `?${queryString}`;
			}

			// Build API URL
			const baseUrl =
				import.meta.env.MODE === 'production' ? PUBLIC_SERVER_PROD_URL : PUBLIC_SERVER_DEV_URL;

			let apiUrl = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=1`;
			if (params.has('contentClasses')) apiUrl += `&contentClasses=${params.get('contentClasses')}`;
			if (params.has('tags')) apiUrl += `&tags=${params.get('tags')}`;

			// Fetch and update
			fetchApi<CellFeaturesResponse>(apiUrl)
				.then((cellFeatures) => {
					// Update the route and state
					pushState(cellRoute, {
						selectedCell: { cellFeatures }
					});
				})
				.catch((error) => {
					console.error('Error updating cell for new content classes:', error);
				});
		}
	});

	// Effect to update the cell when currentPeriod changes
	$effect(() => {
		if (browser && currentPeriod && currentPeriod !== previousPeriod && $page.state.selectedCell) {
			loadingNewPeriod = true;
			
			// Get the currently selected cell ID
			const cellId = $page.state.selectedCell.cellFeatures.cellId;

			// Build new cell route with the new period
			let cellRoute = `/cells/${currentPeriod}/${cellId}`;

			// Add query parameters
			const params = new URLSearchParams();

			if (selectedClasses.size > 0) {
				params.set('contentClasses', Array.from(selectedClasses).join(','));
			}

			if (selectedTags.size > 0) {
				params.set('tags', Array.from(selectedTags).join(','));
			}

			// Add search params if we have any
			const queryString = params.toString();
			if (queryString) {
				cellRoute += `?${queryString}`;
			}

			// Build API URL
			const baseUrl =
				import.meta.env.MODE === 'production' ? PUBLIC_SERVER_PROD_URL : PUBLIC_SERVER_DEV_URL;

			let apiUrl = `${baseUrl}/grid/cell/${cellId}?period=${currentPeriod}&page=1`;
			if (params.has('contentClasses')) apiUrl += `&contentClasses=${params.get('contentClasses')}`;
			if (params.has('tags')) apiUrl += `&tags=${params.get('tags')}`;

			// Fetch and update
			fetchApi<CellFeaturesResponse>(apiUrl)
				.then((cellFeatures) => {
					// Update the route and state
					pushState(cellRoute, {
						selectedCell: { cellFeatures }
					});
					loadingNewPeriod = false;
				})
				.catch((error) => {
					console.error('Error updating cell for new period:', error);
					loadingNewPeriod = false;
				});
		}

		// Update previous period
		previousPeriod = currentPeriod;
	});
</script>

<div class="relative flex flex-col w-screen h-screen">
	<ToggleGroupSelector
		featuresStatistics={featuresStatistics}
		initialSelectedClasses={Array.from(selectedClasses)}
		initialSelectedTags={Array.from(selectedTags)}
		onClassesChange={handleClassesChange}
		onTagsChange={handleTagsChange}
	/>

	{#if isLoading}
		<div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-50">
			<div class="loader"></div>
		</div>
	{/if}

	{#if heatmaps && currentPeriod && heatmaps[currentPeriod]}
		<div class="relative flex-1">
			<MapGLGrid
				class="w-full h-full z-10"
				heatmap={heatmaps[currentPeriod]}
				{heatmapBlueprint}
				{dimensions}
				selectedCellId={$page.state.selectedCell?.cellFeatures.cellId}
				on:cellClick={handleCellClick}
			/>

			{#if $page.state.selectedCell}
				<div
					class="z-40 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300"
				>
					{#if loadingNewPeriod}
						<div>Loading new period data...</div>
					{:else}
						{#key [$page.state.selectedCell.cellFeatures.cellId, currentPeriod]}
							<CellPage data={$page.state.selectedCell} />
						{/key}
					{/if}
				</div>
			{/if}
		</div>
	{/if}

	{#if timePeriods}
		<HeatmapSlider {timePeriods} bind:value={currentPeriod} />
	{/if}
</div>

<style>
	.loader {
		border: 5px solid #f3f3f3;
		border-radius: 50%;
		border-top: 5px solid #3498db;
		width: 50px;
		height: 50px;
		animation: spin 2s linear infinite;
	}

	@keyframes spin {
		0% {
			transform: rotate(0deg);
		}
		100% {
			transform: rotate(360deg);
		}
	}
</style>

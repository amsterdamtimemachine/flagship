<!-- (map)/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { replaceState } from '$app/navigation';
	import { page } from '$app/state';
	import debounce from 'lodash.debounce';
	import { fetchApi } from '$api';
	import { createMapController } from '$controllers/MapController.svelte';
	import MapContainer from '$components/MapContainer.svelte';
	import Map from '$components/Map.svelte';
	import ToggleGroupSelector from '$components/ToggleGroupSelector.svelte';
	import TimePeriodSelector from '$components/TimePeriodSelector.svelte';
	import CellView from '$components/CellView.svelte';
	import ErrorHandler from '$lib/components/ErrorHandler.svelte';
	import type { PageData } from './$types';
	import type { CellFeaturesResponse } from '@atm/shared-types';
	import {
		PUBLIC_SERVER_DEV_URL,
		PUBLIC_SERVER_PROD_URL
	} from '$env/static/public';

	let { data }: { data: PageData } = $props();

	let dimensions = $derived(data?.metadata?.dimensions);
	let heatmaps = $derived(data?.heatmaps?.heatmaps);
	let heatmapBlueprint = $derived(data?.metadata?.heatmapBlueprint?.cells);
	let timePeriods = $derived(data?.metadata?.timePeriods);
	let featuresStatistics = $derived(data?.metadata?.featuresStatistics);
	let histogram = $derived(data?.histogram?.histogram);

	const mapController = $state(createMapController());
	
	// Client-side cell data management
	let cellData = $state(null);
	let cellLoading = $state(false);
	let showCellModal = $derived(!!cellData);
	
	// Use MapController's period state for reactivity
	let currentPeriod = $derived(mapController.getCurrentPeriod());
	let selectedCellId = $derived(mapController.getSelectedCellId());
	
	let currentHeatmap = $derived.by(() => {
		if (heatmaps && currentPeriod) {
			return heatmaps[currentPeriod];
		}
		return null;
	});

	const baseUrl = import.meta.env.MODE === 'production' ? PUBLIC_SERVER_PROD_URL : PUBLIC_SERVER_DEV_URL;

	// Debounced cell data refresh for period changes
	const debouncedCellRefresh = debounce(async () => {
		if (cellData && currentPeriod) {
			await loadCellData(cellData.cellFeatures.cellId, currentPeriod);
		}
	}, 300);

	onMount(() => {
		if (timePeriods) {
			// Initialize with server data as starting point
			mapController.initialize(timePeriods, data.currentPeriod);
		}

		// Check if cell should be opened from URL
		const cellParam = page.url.searchParams.get('cell');
		if (cellParam && data.currentPeriod) {
			loadCellData(cellParam, data.currentPeriod);
		}
	});

	async function loadCellData(cellId: string, period: string) {
		cellLoading = true;
		try {
			const contentClasses = page.url.searchParams.get('contentClasses') || '';
			const tags = page.url.searchParams.get('tags') || '';
			
			let cellApiUrl = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=1`;
			if (contentClasses) cellApiUrl += `&contentClasses=${contentClasses}`;
			if (tags) cellApiUrl += `&tags=${tags}`;
			
			const cellFeatures = await fetchApi<CellFeaturesResponse>(cellApiUrl);
			cellData = { cellFeatures };
			
			// Update URL to reflect cell selection
			const url = new URL(window.location.href);
			url.searchParams.set('cell', cellId);
			replaceState(url.pathname + url.search, page.state);
			
		} catch (error) {
			console.error('Error loading cell data:', error);
			// Could show error toast here
		} finally {
			cellLoading = false;
		}
	}

	// Handle period change via slider - fast, no server reload
	function handlePeriodChange(period: string) {
		const url = new URL(window.location.href);
		url.searchParams.set('period', period);
		
		// Update URL without triggering load function
		replaceState(url.pathname + url.search, page.state);
		
		// Update MapController internal state
		mapController.setPeriod(period);
		
		// Debounced cell refresh if cell is open
		debouncedCellRefresh();
	}

	// Handle filter changes - refetch static data
	function handleFiltersChange(classes: string[], tags: string[]) {
		const url = new URL(window.location.href);
		
		if (classes.length > 0) {
			url.searchParams.set('contentClasses', classes.join(','));
		} else {
			url.searchParams.delete('contentClasses');
		}
		
		if (tags.length > 0) {
			url.searchParams.set('tags', tags.join(','));
		} else {
			url.searchParams.delete('tags');
		}
		
		// This triggers load function rerun - will refetch static data with new filters
		goto(url.pathname + url.search);
		
		// If cell is open, also refresh cell data with new filters
		if (cellData) {
			loadCellData(cellData.cellFeatures.cellId, currentPeriod);
		}
	}

	// Handle cell selection
	function handleCellClick(cellId: string) {
		loadCellData(cellId, currentPeriod);
	}

	// Handle cell close
	function handleCellClose() {
		cellData = null;
		
		// Remove cell from URL
		const url = new URL(window.location.href);
		url.searchParams.delete('cell');
		replaceState(url.pathname + url.search, page.state);
	}
</script>

<ErrorHandler errorData={data.errorData} />

<div class="relative flex flex-col w-screen h-screen">
	<!-- Toggle selector for content classes and tags -->
	<!--
	<ToggleGroupSelector
		featuresStatistics={featuresStatistics}
		initialSelectedClasses={mapController.getSelectedClassesArray()}
		initialSelectedTags={mapController.getSelectedTagsArray()}
		onClassesChange={(classes) => {
			mapController.handleClassesChange(classes);
			handleFiltersChange(classes, mapController.getSelectedTagsArray());
		}}
		onTagsChange={(tags) => {
			mapController.handleTagsChange(tags);
			handleFiltersChange(mapController.getSelectedClassesArray(), tags);
		}}
	/>
	-->

	{#if mapController.isLoading}
		<div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-50">
			<div class="loader"></div>
		</div>
	{/if}

	<div class="relative flex-1">
		<MapContainer controller={mapController}>
			{#snippet map(props)}
				<Map
					heatmap={currentHeatmap}
					{heatmapBlueprint}
					{dimensions}
					selectedCellId={cellData?.cellFeatures?.cellId}
					handleCellClick={handleCellClick}
					handleMapLoaded={props.handleMapLoaded}
				/>
			{/snippet}
		</MapContainer>

		<!-- Cell Modal with Loading State -->
		{#if showCellModal}
			<div class="z-40 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300">
				{#if cellLoading}
					<div class="flex items-center justify-center h-20">
						<div class="loader"></div>
					</div>
				{:else if cellData}
					<CellView data={cellData} onClose={handleCellClose} />
				{/if}
			</div>
		{/if}
	</div>

	{#if timePeriods && histogram}
		<TimePeriodSelector 
			period={currentPeriod} 
			{histogram} 
			onPeriodChange={handlePeriodChange} 
		/>
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
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}
</style>

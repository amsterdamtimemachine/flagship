<!-- (map)/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import debounce from 'lodash.debounce';	
	import { createMapController } from '$state/MapController.svelte';
	import { createPageErrorData } from '$utils/error';
	import Map from '$components/Map.svelte';
	import TimePeriodSelector from '$components/TimePeriodSelector.svelte';
	import ToggleGroup from '$components/ToggleGroup.svelte';
	import CellView from '$components/CellView.svelte';
	import ErrorHandler from '$lib/components/ErrorHandler.svelte';
	
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Derived data from server
	let dimensions = $derived(data?.metadata?.heatmapDimensions);
	let recordTypes = $derived(data?.metadata?.recordTypes);
	let heatmaps = $derived(data?.heatmaps?.heatmapTimeline);
	let heatmapBlueprint = $derived(data?.metadata?.heatmapBlueprint?.cells);
//	let timePeriods = $derived(data?.metadata?.timePeriods);
	let histogram = $derived(data?.histogram?.histogram);

	// Centralized state management
	const controller = createMapController();
	
	// Derived state from controller
	let currentPeriod = $derived(controller.currentPeriod);
	let selectedCellId = $derived(controller.selectedCellId);
	let cellData = $derived(controller.cellData);
	let showCellModal = $derived(controller.showCellModal);
	
	// Combine server errors with controller errors for ErrorHandler
	let allErrors = $derived.by(() => {
		const serverErrors = data.errorData?.errors || [];
		const controllerErrors = controller.errors || [];
		return createPageErrorData([...serverErrors, ...controllerErrors]);
	});
	
	let currentHeatmap = $derived.by(() => {
		if (heatmaps && currentPeriod && data.currentRecordType) {
			const timeSliceData = heatmaps[currentPeriod];
			return timeSliceData?.[data.currentRecordType]?.base;
		}
		return null;
	});

	// Debounced period changes to avoid too many API calls
	const debouncedPeriodChange = debounce((period: string) => {
		controller.setPeriod(period);
	}, 300);

	onMount(() => {
		// Initialize controller with period from URL or first available time period
		const urlParams = new URLSearchParams(window.location.search);
		const periodFromUrl = urlParams.get('period');
		const firstPeriod = histogram?.bins?.[0]?.timeSlice?.key;
		
		// Use period from URL if valid, otherwise fall back to first period
		let initialPeriod = firstPeriod || '';
		if (periodFromUrl && histogram?.bins?.some(bin => bin.timeSlice.key === periodFromUrl)) {
			initialPeriod = periodFromUrl;
		}
		
		controller.initialize(initialPeriod);
	});

	// Handle period change from slider
	function handlePeriodChange(period: string) {
		debouncedPeriodChange(period);
	}

	// Handle cell selection from map
	function handleCellClick(cellId: string | null) {
		if (cellId && heatmapBlueprint) {
			// Find the cell bounds from the blueprint
			const cell = heatmapBlueprint.find(c => c.cellId === cellId);
			if (cell?.bounds) {
				controller.selectCell(cellId, {
					minlat: cell.bounds.minlat,
					maxlat: cell.bounds.maxlat,
					minlon: cell.bounds.minlon,
					maxlon: cell.bounds.maxlon
				});
			} else {
				controller.selectCell(cellId);
			}
		} else {
			controller.selectCell(null);
		}
	}

	// Handle cell modal close
	function handleCellClose() {
		// Clear any cell-related errors when closing
		controller.clearErrors();
		controller.selectCell(null);
	}
</script>

<ErrorHandler errorData={allErrors} />

<div class="relative flex flex-col w-screen h-screen">
	<div class="relative flex-1">
		<ToggleGroup items={recordTypes} class="absolute z-50"/>
		{#if currentHeatmap && heatmapBlueprint && dimensions}
			<Map
				heatmap={currentHeatmap}
				{heatmapBlueprint}
				{dimensions}
				{selectedCellId}
				handleCellClick={handleCellClick}
			/>
		{/if}

		{#if showCellModal}
			<div class="z-50 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300">
				<CellView data={cellData} onClose={handleCellClose} />
			</div>
		{/if}
	</div>

	{#if histogram}
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

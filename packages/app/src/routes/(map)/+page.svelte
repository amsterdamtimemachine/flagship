<!-- (map)/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import debounce from 'lodash.debounce';	
	import { createMapController } from '$state/MapController.svelte';
	import { createPageErrorData } from '$utils/error';
	import Map from '$components/Map.svelte';
	import TimePeriodSelector from '$components/TimePeriodSelector.svelte';
	import CellView from '$components/CellView.svelte';
	import ErrorHandler from '$lib/components/ErrorHandler.svelte';
	
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Derived data from server
	let dimensions = $derived(data?.metadata?.heatmapDimensions);
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
	let cellLoading = $derived(controller.isLoadingCell);
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
		// Initialize controller with first available time period
		const firstPeriod = histogram?.bins?.[0]?.timeSlice?.key;
		controller.initialize(firstPeriod || '');
	});

	// Handle period change from slider
	function handlePeriodChange(period: string) {
		debouncedPeriodChange(period);
	}

	// Handle cell selection from map
	function handleCellClick(cellId: string | null) {
		controller.selectCell(cellId);
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

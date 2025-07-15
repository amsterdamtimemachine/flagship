<!-- (map)/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import debounce from 'lodash.debounce';	
	import { createMapController } from '$state/MapController.svelte';
	import { createPageErrorData } from '$utils/error';
	import { mergeHeatmapTimeline } from '$utils/heatmap';
	import Map from '$components/Map.svelte';
	import TimePeriodSelector from '$components/TimePeriodSelector.svelte';
	import ToggleGroup from '$components/ToggleGroup.svelte';
	import ToggleGroupSimple from '$components/ToggleGroupSimple.svelte';
	import CellView from '$components/CellView.svelte';
	import ErrorHandler from '$lib/components/ErrorHandler.svelte';
	
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Derived data from server
	let dimensions = $derived(data?.metadata?.heatmapDimensions);
	let recordTypes = $derived(data?.metadata?.recordTypes);
	let heatmapTimeline = $derived(data?.heatmapTimeline?.heatmapTimeline);
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
	
	// Merge timeline once when data changes (for smooth navigation)
	let mergedTimeline = $derived.by(() => {
		if (heatmapTimeline && data.currentRecordTypes && data.currentRecordTypes.length > 0) {
			const needsMerging = data.currentRecordTypes.length > 1 || (data.tags && data.tags.length > 0);
			
			if (needsMerging) {
				// Merge entire timeline for smooth navigation
				const selectedTag = data.tags && data.tags.length > 0 ? data.tags[0] : undefined;
				return mergeHeatmapTimeline(heatmapTimeline, data.currentRecordTypes, selectedTag, heatmapBlueprint);
			} else {
				// Single recordType, no tags - use original timeline
				return heatmapTimeline;
			}
		}
		return null;
	});

	// Use histogram directly since backend handles merging
	let mergedHistogram = $derived(histogram);

	// Get current heatmap from merged timeline
	let currentHeatmap = $derived.by(() => {
		if (mergedTimeline && currentPeriod) {
			const timeSliceData = mergedTimeline[currentPeriod];
			if (timeSliceData) {
				if (data.currentRecordTypes.length > 1 || (data.tags && data.tags.length > 0)) {
					// Merged data: use combined recordType key
					const combinedKey = data.currentRecordTypes.sort().join('+');
					return timeSliceData[combinedKey]?.base || null;
				} else {
					// Single recordType: use original structure
					const recordType = data.currentRecordTypes[0];
					return timeSliceData[recordType]?.base || null;
				}
			}
		}
		return null;
	});
	
		$inspect(currentHeatmap);

	// Debounced period changes to avoid too many API calls
	const debouncedPeriodChange = debounce((period: string) => {
		controller.setPeriod(period);
	}, 300);

	onMount(() => {
		// Initialize controller with period from URL or first available time period
		const urlParams = new URLSearchParams(window.location.search);
		const periodFromUrl = urlParams.get('period');
		const firstPeriod = mergedHistogram?.bins?.[0]?.timeSlice?.key;
		
		// Use period from URL if valid, otherwise fall back to first period
		let initialPeriod = firstPeriod || '';
		if (periodFromUrl && mergedHistogram?.bins?.some(bin => bin.timeSlice.key === periodFromUrl)) {
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
		<ToggleGroup items={["A", "B,", "C"]} class="absolute z-50"/>
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

	{#if mergedHistogram}
		<TimePeriodSelector 
			period={currentPeriod} 
			histogram={mergedHistogram} 
			onPeriodChange={handlePeriodChange} 
		/>
	{/if}
</div>


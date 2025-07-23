<!-- (map)/+page.svelte -->
<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { onNavigate, afterNavigate } from '$app/navigation';
	import debounce from 'lodash.debounce';	
	import { createMapController } from '$state/MapController.svelte';
	import { createPageErrorData } from '$utils/error';
	import { mergeHeatmapTimeline, mergeHeatmaps } from '$utils/heatmap';
	import { mergeHistograms } from '$utils/histogram';
	import { loadingState } from '$lib/state/loadingState.svelte';
	import Map from '$components/Map.svelte';
	import TimePeriodSelector from '$components/TimePeriodSelector.svelte';
	import TimePeriodSelector2 from '$components/TimePeriodSelector2.svelte';
	import ToggleGroup from '$components/ToggleGroup.svelte';
	import CellView from '$components/CellView.svelte';
	import ErrorHandler from '$lib/components/ErrorHandler.svelte';
	
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Derived data from server
	let dimensions = $derived(data?.metadata?.heatmapDimensions);
	let recordTypes = $derived(data?.metadata?.recordTypes);
	let heatmapTimeline = $derived(data?.heatmapTimeline?.heatmapTimeline);
	let heatmapBlueprint = $derived(data?.metadata?.heatmapBlueprint?.cells);
	let currentRecordTypes = $derived(data?.currentRecordTypes);
	let tags = $derived(data?.tags);
	let histogram = $derived(data?.histogram?.histogram);

	const controller = createMapController();	
	let currentPeriod = $derived(controller.currentPeriod);
	let selectedCellId = $derived(controller.selectedCellId);
	let selectedCellBounds = $derived(controller.selectedCellBounds);
	let showCellModal = $derived(controller.showCellModal);
	
	
	// Combine server errors with controller errors for ErrorHandler
	let allErrors = $derived.by(() => {
		const serverErrors = data.errorData?.errors || [];
		const controllerErrors = controller.errors || [];
		return createPageErrorData([...serverErrors, ...controllerErrors]);
	});
	
	let mergedHeatmapTimeline = $derived.by(() => {
		if (heatmapTimeline && currentRecordTypes && recordTypes) {
			// Empty selection = show all recordTypes (default behavior)
			const effectiveRecordTypes = currentRecordTypes.length > 0 
				? currentRecordTypes 
				: recordTypes;
			
			const timelineData = heatmapTimeline?.heatmapTimeline || heatmapTimeline;
			
			const needsMerging = effectiveRecordTypes.length > 1 || (tags && tags.length > 0);
			
			if (needsMerging) {
				// Merge entire timeline for smooth navigation
				const selectedTag = tags && tags.length > 0 ? tags[0] : undefined;
				return mergeHeatmapTimeline(timelineData, effectiveRecordTypes, selectedTag, heatmapBlueprint);
			} else {
				// Single recordType, no tags - use original timeline
				return timelineData;
			}
		}
		return null;
	});


	$inspect(mergedHeatmapTimeline);


	// Use histogram directly since backend handles merging
	// Note: Server-side histogram fetching already handles empty recordTypes as "all types"
	let mergedHistogram = $derived(histogram);

	// Get current heatmap - just pick from pre-merged timeline
	let currentHeatmap = $derived.by(() => {
		if (mergedHeatmapTimeline && currentPeriod) {
			const timeSliceData = mergedHeatmapTimeline[currentPeriod];
			if (timeSliceData) {
				// Just grab the pre-merged heatmap (there's only one key per time slice)
				const mergedKey = Object.keys(timeSliceData)[0];
				return timeSliceData[mergedKey]?.base || null;
			}
		}
		
		// Return empty heatmap when no data exists for this period
		// This keeps the map visible with all cells at 0 density
		if (heatmapBlueprint && dimensions) {
			const gridSize = dimensions.colsAmount * dimensions.rowsAmount;
			return {
				countArray: new Array(gridSize).fill(0),
				densityArray: new Array(gridSize).fill(0)
			};
		}
		
		return null;
	});

	$inspect("curr ", currentHeatmap);
	console.log(" bp ", heatmapBlueprint);

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
		
		// Fallback to first heatmap period if histogram doesn't have data
		if (!initialPeriod && mergedHeatmapTimeline) {
			const heatmapPeriods = Object.keys(mergedHeatmapTimeline);
			if (heatmapPeriods.length > 0) {
				initialPeriod = heatmapPeriods[0];
			}
		}
		controller.initialize(initialPeriod);
		
		// Set up cell selection callback
		controller.onCellSelected = (cellId: string | null, bounds?: { minLat: number; maxLat: number; minLon: number; maxLon: number }) => {
			// No additional logic needed - controller handles URL updates
			// CellView will handle data fetching when rendered
		};
		
		// Sync URL parameters after router is ready
		tick().then(() => {
			controller.syncUrlParameters(initialPeriod);
		});
	});

	onNavigate(() => {
		loadingState.startLoading();
	});

	afterNavigate(() => {
		loadingState.stopLoading();
	});

	// Handle period change from slider
	function handlePeriodChange(period: string) {
		debouncedPeriodChange(period);
	}

	function handleRecordTypeChange(recordTypes: string[]) {
		controller.setRecordType(recordTypes);
	}

	// Handle cell selection from map
	function handleCellClick(cellId: string | null) {
		if (cellId && heatmapBlueprint) {
			// Find the cell bounds from the blueprint
			const cell = heatmapBlueprint.find(c => c.cellId === cellId);
			if (cell?.bounds) {
				controller.selectCell(cellId, {
					minLat: cell.bounds.minLat,
					maxLat: cell.bounds.maxLat,
					minLon: cell.bounds.minLon,
					maxLon: cell.bounds.maxLon
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
		controller.clearErrors();
		controller.selectCell(null);
	}
</script>

<ErrorHandler errorData={allErrors} />

<div class="relative flex flex-col w-screen h-screen">
	<div class="relative flex-1">
		<ToggleGroup items={recordTypes} selectedItems={currentRecordTypes} onItemSelected={handleRecordTypeChange} class="absolute z-50 top-5 left-5"/>
		{#if currentHeatmap && heatmapBlueprint && dimensions}
			<Map
				heatmap={currentHeatmap}
				{heatmapBlueprint}
				{dimensions}
				{selectedCellId}
				handleCellClick={handleCellClick}
			/>
		{/if}

		{#if showCellModal && selectedCellId}
			<div class="z-50 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300">
				<CellView 
					cellId={selectedCellId} 
					period={currentPeriod} 
					bounds={selectedCellBounds}
					recordTypes={currentRecordTypes}
					onClose={handleCellClose} 
				/>
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


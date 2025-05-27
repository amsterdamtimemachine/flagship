<!-- src/routes/(map)/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { createMapController } from '$controllers/MapController.svelte';
	//import type { MapController } from '$controllers/types';
	import MapContainer from '$components/MapContainer.svelte';
	import Map from '$components/Map.svelte';
	import ToggleGroupSelector from '$components/ToggleGroupSelector.svelte';
	import HeatmapSlider from '$components/HeatmapSlider.svelte';
	import TimePeriodSelector from '$components/TimePeriodSelector.svelte';
	// import CellPage from '$routes/(map)/cells/[period]/[cellId]/+page.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	let dimensions = $derived(data?.metadata?.dimensions);
	let heatmaps = $derived(data?.heatmaps?.heatmaps);
	let heatmapBlueprint = $derived(data?.metadata?.heatmapBlueprint?.cells);
	let timePeriods = $derived(data?.metadata?.timePeriods);
	let featuresStatistics = $derived(data?.metadata?.featuresStatistics);
	let histogram = $derived(data?.histogram?.histogram);

	const mapController = $state(createMapController());
	let currentPeriod = $derived(mapController.getCurrentPeriod());
	let selectedCellId = $derived(mapController.getSelectedCellId());
	let currentHeatmap = $derived.by(() => {
		if (heatmaps && currentPeriod) {
			return heatmaps[currentPeriod];
		}
		return null;
	});

	onMount(() => {
		if (timePeriods) {
			const initialPeriod = data.initialPeriod || undefined;
			mapController.initialize(timePeriods, initialPeriod);
		}
	});

	// Handle period change
	function handlePeriodChange(period: string) {
		mapController.updatePeriod(period);
		//
		// // If there's a selected cell, update it with the new period
		// if (selectedCellId) {
		//   mapController.updateCellWithPeriod();
		// }
	}

	// Effect to watch for filter changes and update data
	// $effect(() => {
	//   const classes = mapController.getSelectedClassesArray();
	//   const tags = mapController.getSelectedTagsArray();
	//
	//   if (classes.length > 0 || tags.length > 0) {
	//     // Update URL to reflect the current selections
	//     mapController.updateUrlFromSelections();
	//
	//     // If there's a selected cell, update it with the new filters
	//     if (selectedCellId) {
	//       mapController.updateCellWithFilters();
	//     }
	//   }
	// });
</script>

<div class="relative flex flex-col w-screen h-screen">
	<!-- Toggle selector for content classes and tags -->
	<!--
  <ToggleGroupSelector
    featuresStatistics={featuresStatistics}
    initialSelectedClasses={mapController.getSelectedClassesArray()}
    initialSelectedTags={mapController.getSelectedTagsArray()}
    onClassesChange={(classes) => mapController.handleClassesChange(classes)}
    onTagsChange={(tags) => mapController.handleTagsChange(tags)}
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
					{selectedCellId}
					handleCellClick={props.handleCellClick}
					handleMapLoaded={props.handleMapLoaded}
				/>
			{/snippet}
		</MapContainer>

		<!--
    {#if page.state.selectedCell}
      <div
        class="z-40 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300"
      >
        {#if mapController.isLoadingNewPeriod}
          <div>Loading new period data...</div>
        {:else}
          {#key [page.state.selectedCell.cellFeatures.cellId, currentPeriod]}
            <CellPage data={page.state.selectedCell} />
            <div>Cell details would go here</div>
          {/key}
        {/if}
      </div>
    {/if}
		-->
	</div>

	{#if timePeriods}
		<TimePeriodSelector period={currentPeriod} {histogram} onPeriodChange={handlePeriodChange} />
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

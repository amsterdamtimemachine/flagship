<!-- src/routes/(map)/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { createMapController } from '$lib/controllers/MapController.svelte';
  import MapVisualization from '$components/MapVisualisation.svelte';
  import ToggleGroupSelector from '$components/ToggleGroupSelector.svelte';
  import HeatmapSlider from '$components/HeatmapSlider.svelte';
  //import CellPage from '$routes/(map)/cells/[period]/[cellId]/+page.svelte';
  
	import type { PageProps } from './$types';
  let { data } : PageProps = $props();

	let mapController = $derived.by(() => {
			if (!data) return null;
			return createMapController(data);
	});

  onMount(() => {
    mapController.initialize();
  });
</script>

<div class="relative flex flex-col w-screen h-screen">
  <!-- For now, keep the ToggleGroupSelector as is -->
	<!--
  <ToggleGroupSelector
    featuresStatistics={mapController.featuresStatistics}
    initialSelectedClasses={mapController.getSelectedClassesArray()}
    initialSelectedTags={mapController.getSelectedTagsArray()}
    onClassesChange={mapController.handleClassesChange}
    onTagsChange={mapController.handleTagsChange}
  />
	-->

  {#if mapController.isLoading}
    <div class="absolute inset-0 flex items-center justify-center bg-white bg-opacity-50 z-50">
      <div class="loader"></div>
    </div>
  {/if}

  <div class="relative flex-1">
    <MapVisualization 
      controller={mapController}
      class="w-full h-full z-10"
    />

		<!---

    {#if page.state.selectedCell}
      <div
        class="z-40 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300"
      >
        {#if mapController.isLoadingNewPeriod}
          <div>Loading new period data...</div>
        {:else}
          {#key [$page.state.selectedCell.cellFeatures.cellId, mapController.currentPeriod]}
            <CellPage data={$page.state.selectedCell} />
          {/key}
        {/if}
      </div>
    {/if}
		-->
  </div>

	<!--
  {#if mapController.timePeriods}
    <HeatmapSlider 
      timePeriods={mapController.timePeriods} 
      bind:value={mapController.currentPeriod}
    />
  {/if}
	-->
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

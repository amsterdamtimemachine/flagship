<script>
	// import MapHeader from '$components/MapHeader.svelte';
	import MapVisualization from '$components/MapVisualization.svelte';
	// import TimelineControls from '$components/TimelineControls.svelte';
	// import CellDetailPanel from '$components/CellDetailPanel.svelte';
	// import LoadingOverlay from '$components/LoadingOverlay.svelte';

	let { mapController } = $props();

	// Derive these from the controller
	let isLoading = $derived(mapController.isLoading);
	let isLoadingNewPeriod = $derived(mapController.isLoadingNewPeriod);
	let selectedCell = $derived(mapController.selectedCell);
	let currentPeriod = $derived(mapController.currentPeriod);
</script>

<div class="relative flex flex-col w-screen h-screen">
	<!--
  <MapHeader 
    controller={mapController} 
    featuresStatistics={mapController.featuresStatistics}
  />
  
  {#if isLoading}
    <LoadingOverlay />
  {/if}
	-->

	<div class="relative flex-1">
		<MapVisualization
			controller={mapController}
			isVisible={!!currentPeriod && !!mapController.heatmaps[currentPeriod]}
		/>

		<!--
    
    {#if selectedCell}
      <CellDetailPanel 
        cellData={selectedCell}
        isLoading={isLoadingNewPeriod}
        period={currentPeriod}
      />
    {/if}

		-->
	</div>

	<!--
  
  {#if mapController.timePeriods}
    <TimelineControls 
      periods={mapController.timePeriods}
      bind:value={mapController.currentPeriod}
    />
  {/if}

	-->
</div>

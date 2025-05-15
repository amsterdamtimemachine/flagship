<!-- src/components/map/MapVisualization.svelte -->
<script lang="ts">
  import Map from '$components/Map.svelte';
  import type { MapController } from '$controllers/MapController';
  
  interface Props {
    controller: MapController;
    class?: string;
  }
  
  let { controller, class: className = '' } = $props();
  
  // Handle cell click and delegate to controller
  function handleCellClick(event: CustomEvent<{id: string | null}>) {
    controller.selectCell(event.detail.id);
  }
  
  // Derived values
  let currentHeatmap = $derived(controller.getCurrentHeatmap());
  let selectedCellId = $derived(controller.getSelectedCellId());
  let isVisible = $derived(
    !!controller.heatmaps && 
    !!controller.currentPeriod && 
    !!controller.heatmaps[controller.currentPeriod]
  );
</script>

{#if isVisible}
  <Map
    class={className}
    heatmap={controller.heatmaps[controller.currentPeriod]}
    heatmapBlueprint={controller.heatmapBlueprint}
    dimensions={controller.dimensions}
    selectedCellId={selectedCellId}
    on:cellClick={handleCellClick}
  />
{/if}

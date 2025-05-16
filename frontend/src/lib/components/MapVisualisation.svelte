<script lang="ts">
  import Map from '$components/Map.svelte';
  import type { MapController } from '$controllers/MapController';
  
  interface Props {
    controller: MapController;
    className?: string;
  }
  
  let { controller, class: className} : Props = $props();

  let currentHeatmap = $derived(controller.getCurrentHeatmap());
  let selectedCellId = $derived(controller.getSelectedCellId());
  let isVisible = $derived(
    !!controller.heatmaps && 
    !!controller.currentPeriod && 
    !!controller.heatmaps[controller.currentPeriod]
  );

  function handleCellClick(event: CustomEvent<{id: string | null}>) {
    controller.selectCell(event.detail.id);
  }

</script>

{#if isVisible}
  <Map
    heatmap={currentHeatmap}
    heatmapBlueprint={controller.heatmapBlueprint}
    dimensions={controller.dimensions}
    selectedCellId={selectedCellId}
    class={className}
    {handleCellClick}

  />
{/if}

<script lang="ts">
    import { onMount } from 'svelte';
    import MapGLGridContainer from '$components/MapGLGridContainer.svelte';
    import MapGLGrid from '$components/MapGLGrid.svelte';
    import HeatmapSlider from '$components/HeatmapSlider.svelte';
    import type { Heatmap } from '@atm/shared-types';
    
    export let data;
    $: heatmaps = data?.metadata?.heatmaps;
    $: dimensions = data?.metadata?.dimensions; 
    $: heatmapBlueprint = data?.metadata?.heatmapBlueprint?.cells;
    // Convert object to array for ordering
    $: periods = heatmaps ? Object.keys(heatmaps).sort() : [];
    $: currentIndex = [0];
    $: currentHeatmap = heatmaps?.[periods[currentIndex[0]]];
    $: console.log(currentHeatmap);
</script>

<div class="flex flex-col w-screen h-screen">
    {#if heatmaps}
        <MapGLGridContainer 
            class="flex-1 w-full h-full relative"
            let:handleCellHover let:handleCellLeave let:handleCellClick>
            <MapGLGrid
                heatmap={currentHeatmap}
                {heatmapBlueprint}
                {dimensions}
                on:cellHover={handleCellHover}
                on:cellLeave={handleCellLeave}
                on:cellClick={handleCellClick}
            />
        </MapGLGridContainer>
        <HeatmapSlider 
            periods={periods} 
            heatmaps={heatmaps} 
            bind:value={currentIndex} 
        /> 
    {/if}
</div>

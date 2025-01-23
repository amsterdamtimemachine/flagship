<script lang="ts">
    import { onMount } from 'svelte';
    import MapGLGridContainer from '$components/MapGLGridContainer.svelte';
    import MapGLGrid from '$components/MapGLGrid.svelte';
    import HeatmapSlider from '$components/HeatmapSlider.svelte';
    import type { Heatmap } from '@atm/shared-types';
    
    export let data;
    $: heatmaps = data?.metadata?.heatmaps;
    $: dimensions = data?.metadata?.dimensions;
    
    let currentIndex = [0];
    $: currentHeatmap = heatmaps?.[currentIndex[0]];
    $: console.log(currentHeatmap);
</script>

<div class="flex flex-col gap-4 w-full h-full">
    {#if heatmaps}
        <HeatmapSlider {heatmaps} bind:value={currentIndex} /> 
        <div class="flex-1">
            <MapGLGridContainer let:handleCellHover let:handleCellLeave let:handleCellClick>
                <MapGLGrid
                    heatmap={currentHeatmap}
                    {dimensions}
                    on:cellHover={handleCellHover}
                    on:cellLeave={handleCellLeave}
                    on:cellClick={handleCellClick}
                />
            </MapGLGridContainer>
        </div>
    {/if}
</div>

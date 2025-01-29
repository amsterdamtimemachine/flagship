<!-- (map)/+page.svelte -->
<script lang="ts">
    import { onMount } from 'svelte';
    import { page } from '$app/stores';
    import { pushState } from '$app/navigation';
    import CellPage from '$routes/(map)/cells/[period]/[cellId]/+page.svelte';
    import MapGLGridContainer from '$components/MapGLGridContainer.svelte';
    import MapGLGrid from '$components/MapGLGrid.svelte';
    import HeatmapSlider from '$components/HeatmapSlider.svelte';
    //import CellData from '$components/CellData.svelte';
    import type { Heatmap } from '@atm/shared-types';
    
    export let data;
    $: heatmaps = data?.metadata?.heatmaps;
    $: dimensions = data?.metadata?.dimensions; 
    $: heatmapBlueprint = data?.metadata?.heatmapBlueprint?.cells;
    $: periods = heatmaps ? Object.keys(heatmaps).sort() : [];
    $: currentIndex = [0];
    $: currentHeatmap = heatmaps?.[periods[currentIndex[0]]];
</script>

<div class="relative flex flex-col w-screen h-screen">
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
        {#if $page.state.selectedCell}
            {page.state.selectedCell}

            <div class="absolute inset-0 bg-white/90 m-4 rounded-lg shadow-lg overflow-y-auto">
                <CellPage data={page.state.selectedCell}/>
            </div>
        {/if}
        <HeatmapSlider 
            periods={periods} 
            heatmaps={heatmaps} 
            bind:value={currentIndex} 
        /> 
    {/if}
</div>

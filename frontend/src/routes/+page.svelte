<script lang="ts">
	import { onMount } from 'svelte';
	import MapGLGridContainer from '$components/MapGLGridContainer.svelte';
  import MapGLGrid from '$components/MapGLGrid.svelte';
	import type { Heatmap } from '@atm/shared-types';
	export let data;

	let heatmaps: Heatmap;
	$: heatmaps = data?.metadata?.heatmaps;
	$: dimensions = data?.metadata?.dimensions;
	$: console.log(data.metadata?.heatmaps[9].period);


</script>

<div>
	{#if heatmaps}
		<MapGLGridContainer let:handleCellHover let:handleCellLeave let:handleCellClick>
			<MapGLGrid
		heatmap={heatmaps[9]}
		{dimensions}
		on:cellHover={handleCellHover}
		on:cellLeave={handleCellLeave}
		on:cellClick={handleCellClick}
			/>
		</MapGLGridContainer>
	{/if}
</div>

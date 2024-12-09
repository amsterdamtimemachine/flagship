<script lang="ts">
	import { onMount } from 'svelte';
	import MapGLGridContainer from '$components/MapGLGridContainer.svelte';
  import MapGLGrid from '$components/MapGLGrid.svelte';
	import type { ImageResponse, GeoImage } from '$types';
	export let data;


	let heatmap: any;

	$: heatmap = data?.heatmap;
	$: console.log("cells fetched :", heatmap.cells.length);


</script>

<div>
	<MapGLGridContainer let:handleCellHover let:handleCellLeave let:handleCellClick>
		<MapGLGrid
        cells={heatmap.cells}
        bounds={heatmap.bounds}
        dimensions={heatmap.dimensions}
        on:cellHover={handleCellHover}
        on:cellLeave={handleCellLeave}
        on:cellClick={handleCellClick}
		/>
	</MapGLGridContainer>
</div>

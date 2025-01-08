<script lang="ts">
	import { onMount } from 'svelte';
	import MapGLGridContainer from '$components/MapGLGridContainer.svelte';
  import MapGLGrid from '$components/MapGLGrid.svelte';
	import type { Heatmap } from '@atm/shared-types';
	export let data;

	let heatmap: Heatmap;
	$: heatmap = data?.heatmap;


</script>

<div>
	<MapGLGridContainer let:handleCellHover let:handleCellLeave let:handleCellClick>
		<MapGLGrid
	heatmap={heatmap}
        on:cellHover={handleCellHover}
        on:cellLeave={handleCellLeave}
        on:cellClick={handleCellClick}
		/>
	</MapGLGridContainer>
</div>

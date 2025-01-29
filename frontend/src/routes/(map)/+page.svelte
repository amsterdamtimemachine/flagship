<!-- (map)/+page.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { preloadData, pushState } from '$app/navigation';
	import { page } from '$app/stores';
	import CellPage from '$routes/(map)/cells/[period]/[cellId]/+page.svelte';
	import MapGLGrid from '$components/MapGLGrid.svelte';
	import HeatmapSlider from '$components/HeatmapSlider.svelte';
	import type { Heatmap } from '@atm/shared-types';

	export let data;
	$: heatmaps = data?.metadata?.heatmaps;
	$: dimensions = data?.metadata?.dimensions;
	$: heatmapBlueprint = data?.metadata?.heatmapBlueprint?.cells;
	$: periods = heatmaps ? Object.keys(heatmaps).sort() : [];
	$: currentIndex = [0];
	$: currentHeatmap = heatmaps?.[periods[currentIndex[0]]];

	let loadingNewPeriod = false;
	$: updateCellDataForPeriod(currentIndex[0]);

	async function updateCellDataForPeriod(index: number) {
		if (!$page.state.selectedCell) return;

		loadingNewPeriod = true;
		try {
			const currentPeriod = periods[index];
			const cellId = $page.state.selectedCell.cellFeatures.cellId;

			const cellRoute = `/cells/${currentPeriod}/${cellId}`;
			const result = await preloadData(cellRoute);

			console.log('Preload result:', result);
			if (result.type === 'loaded' && result.status === 200) {
				// Always update state, even with empty data
				pushState(cellRoute, {
					selectedCell: result.data
				});
			}
		} finally {
			loadingNewPeriod = false;
		}
	}

	async function handleCellClick(event: CustomEvent) {
		const { id, period } = event.detail;
		const cellRoute = `/cells/${period}/${id}`;

		const result = await preloadData(cellRoute);
		if (result.type === 'loaded' && result.status === 200) {
			pushState(cellRoute, {
				selectedCell: result.data
			});
		}
	}
</script>

<div class="relative flex flex-col w-screen h-screen">
	{#if heatmaps}
		<div class="relative flex-1">
			<MapGLGrid
				class="w-full h-full z-10"
				heatmap={currentHeatmap}
				{heatmapBlueprint}
				{dimensions}
				selectedCellId={$page.state.selectedCell?.cellFeatures.cellId}
				on:cellClick={handleCellClick}
			/>
			{#if $page.state.selectedCell}
				<div
					class="z-40 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300"
				>
					{#if loadingNewPeriod}
						<div>Loading new period data...</div>
					{:else}
						{#key [$page.state.selectedCell.cellFeatures.cellId, periods[currentIndex[0]]]}
							<CellPage data={$page.state.selectedCell} />
						{/key}
					{/if}
				</div>
			{/if}
		</div>
		<HeatmapSlider {periods} {heatmaps} bind:value={currentIndex} />
	{/if}
</div>

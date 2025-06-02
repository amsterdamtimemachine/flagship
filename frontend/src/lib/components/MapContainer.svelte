<!-- Map Container -->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import Map, { type Props as MapProps } from '$components/Map.svelte';
	import type { Heatmap, HeatmapCell, GridDimensions } from '@atm/shared-types';
	//import type { MapController } from '$controllers/types';

	interface Props {
		map: Snippet<[MapProps]>;
		controller: any; // WIP, create MapController type once the Comp stabilises
		class?: string;
	}

	let { map, controller, class: className }: Props = $props();

	function handleCellClick(cellId: string | null): void {
		controller.selectCell(cellId);
	}

	function handleMapLoaded(): void {
		// currently not used but maybe i'll need to inform the controller when the maps is ready so let's keep it for now
	}
</script>

{@render map({ handleCellClick, handleMapLoaded })}

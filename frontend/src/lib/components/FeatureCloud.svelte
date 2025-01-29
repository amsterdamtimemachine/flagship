<!-- ImageCloud.svelte -->
<script lang="ts">
	import type { GeoFeature } from '@atm/shared-types';
	import FeatureBlock from './FeatureBlock.svelte';

	export let features: GeoFeature[];

	function chunkFeatures(features: GeoFeature[]) {
		const rows: GeoFeature[][] = [];
		for (let i = 0; i < features.length; i += 3) {
			rows.push(features.slice(i, i + 3));
		}
		return rows;
	}

	$: rows = chunkFeatures(features);
</script>

<div class="flex flex-col items-center gap-4 p-4">
	{#each rows as row}
		<div class="flex justify-center gap-4 h-48">
			{#each row as feature}
				<div class="h-full">
					<FeatureBlock {feature} />
				</div>
			{/each}
		</div>
	{/each}
</div>

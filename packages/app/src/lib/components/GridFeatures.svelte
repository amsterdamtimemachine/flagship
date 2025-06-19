<script lang="ts">
	import type { AnyProcessedFeature } from '@atm/shared/types';
	import Masonry from 'svelte-masonry';
	import BlockImage from '$components/BlockImage.svelte';
	import BlockEvent from '$components/BlockEvent.svelte';
	type Props = {
		features: AnyProcessedFeature[];
	};

	let { features }: Props = $props();

	// function getFeatureId(feature: GeoFeatures) {
	//   return `${feature.content_class}-${feature.properties.title}`;
	// }
</script>

<div class="w-100">
	<Masonry gridGap={'10px'} colWidth={'150px'}>
		{#each features as feature, index (index)}
			{#if feature.content_class === 'Event'}
				<BlockEvent {feature} />
			{:else if feature.content_class === 'Image'}
				<BlockImage {feature} />
			{/if}
		{/each}
	</Masonry>
</div>

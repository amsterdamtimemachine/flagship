<script lang="ts">
	import Masonry from 'svelte-masonry';
	import FeatureCard from '$components/FeatureCard.svelte';
	import FeatureImage from '$components/FeatureImage.svelte';
	import BlockText from '$components/BlockText.svelte';
	import type { RawFeature } from '@atm/shared/types';
	
	type Props = {
		features: RawFeature[]; 
	};

	let { features }: Props = $props();

	console.log("FEATURE :", features[0]);

	// returning a string because record types are not predefined
	function getFeatureType(feature: RawFeature): string {
		feature?.recordType ? feature.recordType : 'unknown';
	}

</script>

<div class="w-100">
	{#if features.length === 0}
		<div class="text-gray-500 p-4">No features to display</div>
	{:else}
		<div class="mb-2 text-sm text-gray-600">Showing {features.length} features</div>
		<Masonry gridGap={'10px'} colWidth={'150px'}>
			{#each features as feature, index (index)}
				{@const featureType = getFeatureType(feature)}
				<FeatureCard>
					{#if featureType === 'image'}
						<FeatureImage {feature} />
					{:else}
						<BlockText {feature} />
					{/if}
				</FeatureCard>
			{/each}
		</Masonry>
	{/if}
</div>

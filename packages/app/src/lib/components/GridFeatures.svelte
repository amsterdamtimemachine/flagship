<script lang="ts">
	import Masonry from 'svelte-masonry';
	import BlockImage from '$components/BlockImage.svelte';
	import BlockText from '$components/BlockText.svelte';
	
	type Props = {
		features: any[]; // Database API features
	};

	let { features }: Props = $props();

	// Function to determine feature type from database API data
	function getFeatureType(feature: any): 'image' | 'text' {
		const props = feature?.properties || {};
		
		// Check for image indicators
		if (props.thumb || props.image || props.photo || props.picture || 
		    props.img_url || props.image_url || props.thumbnail) {
			return 'image';
		}
		
		// Check if recordType indicates image
		if (props.recordType === 'image' || props.record_type === 'image') {
			return 'image';
		}
		
		// Default to text for everything else
		return 'text';
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
				{#if featureType === 'image'}
					<BlockImage {feature} />
				{:else}
					<BlockText {feature} />
				{/if}
			{/each}
		</Masonry>
	{/if}
</div>

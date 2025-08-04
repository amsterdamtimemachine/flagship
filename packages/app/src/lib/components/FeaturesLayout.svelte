<script lang="ts">
	import FeatureCard from '$components/FeatureCard.svelte';
	import type { RawFeature } from '@atm/shared/types';
	
	type Props = {
		features: RawFeature[]; 
	}
	let { features }: Props = $props();
</script>

<div class="w-100">
	{#if features.length === 0}
		<div class="text-gray-500 p-4">No features to display</div>
	{:else}
		<div class="mb-2 text-sm text-gray-600">Showing {features.length} features</div>
		<div class="w-100 grid grid-cols-3 gap-4">
			{#each features as feature, index (index)}
				<FeatureCard feature={feature}/>
			{/each}
		</div>
	{/if}
</div>

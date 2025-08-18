<script lang="ts">
	import { onMount } from 'svelte';
	import FeatureCard from '$components/FeatureCard.svelte';
	import { layoutMasonry } from '$utils/masonry';
	import type { RawFeature } from '@atm/shared/types';
	
	type Props = {
		features: RawFeature[]; 
	}
	let { features }: Props = $props();
	
	let masonryContainer: HTMLElement;
	
	onMount(() => {
		if (masonryContainer) {
			layoutMasonry(masonryContainer);
		}
	});
	
	// Re-layout when features change
	$effect(() => {
		if (masonryContainer && features.length > 0) {
			setTimeout(() => layoutMasonry(masonryContainer), 10);
		}
	});
</script>

<div class="w-full">
	{#if features.length === 0}
		<div class="text-gray-500 p-4">No features to display</div>
	{:else}
		<div class="mb-2 text-sm text-gray-600">Showing {features.length} features</div>
		<div class="masonry-layout" bind:this={masonryContainer}>
			<div class="masonry-column"></div>
			<div class="masonry-column"></div>
			<div class="masonry-column"></div>
			{#each features as feature, index (index)}
				<div class="masonry-item">
					<FeatureCard {feature}/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.masonry-layout {
		--column-count: 3;
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(var(--column-count), 1fr);
		width: 100%;
	}

	@media (max-width: 768px) {
		.masonry-layout {
			--column-count: 2;
		}
	}

	@media (max-width: 480px) {
		.masonry-layout {
			--column-count: 1;
		}
	}

	.masonry-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.masonry-column:empty {
		display: none;
	}

	.masonry-item {
		break-inside: avoid;
		display: flex;
		position: relative;
		width: 100%;
	}
</style>

<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import FeatureCard from '$components/FeatureCard.svelte';
	import { createMasonry, type MasonryInstance } from '$utils/masonry';
	import { 
		PUBLIC_MASONRY_IMAGE_WEIGHT,
		PUBLIC_MASONRY_TEXT_WEIGHT, 
		PUBLIC_MASONRY_PERSON_WEIGHT
	} from '$env/static/public';
	import type { RawFeature } from '@atm/shared/types';
	
	type CardWeight = 'light' | 'medium' | 'heavy';
	
	function getCardWeight(feature: RawFeature): CardWeight {
		switch (feature.recordType) {
			case 'image':
				return (PUBLIC_MASONRY_IMAGE_WEIGHT as CardWeight) || 'heavy';
			case 'text':
				return (PUBLIC_MASONRY_TEXT_WEIGHT as CardWeight) || 'light';
			case 'person':
				return (PUBLIC_MASONRY_PERSON_WEIGHT as CardWeight) || 'medium';
			default:
				return 'light';
		}
	}
	
	type Props = {
		features: RawFeature[];
		columns?: number;
	}
	let { features, columns }: Props = $props();
	
	// Use CSS-only responsive columns if no explicit columns prop provided
	const useResponsiveColumns = columns === undefined;
	
	let masonryContainer: HTMLElement;
	let masonry: MasonryInstance | null = null;
	
	onMount(() => {
		if (masonryContainer) {
			try {
				masonry = createMasonry(masonryContainer, { debounceDelay: 150 });
			} catch (error) {
				console.error('Failed to initialize masonry layout:', error);
			}
		}
	});
	
	onDestroy(() => {
		masonry?.destroy();
	});
	
	// Re-layout when features change
	$effect(() => {
		// This effect tracks 'features' changes
		if (masonry && features.length > 0) {
			console.log("🔄 Features changed, re-laying out:", features.length);
			setTimeout(() => masonry?.layout(true), 10);
		}
	});
</script>

<div class="w-full">
	{#if features.length === 0}
		<div class="text-gray-500 p-4">No features to display</div>
	{:else}
		<div class="mb-2 text-sm text-gray-600">Showing {features.length} features</div>
		<div 
			class="masonry-layout" 
			class:responsive={useResponsiveColumns}
			bind:this={masonryContainer} 
			style:--column-count={useResponsiveColumns ? null : columns}
		>
			{#each Array(useResponsiveColumns ? 3 : (columns || 3)) as _, columnIndex}
				<div class="masonry-column"></div>
			{/each}
			{#each features as feature, index (index)}
				<div class="masonry-item" data-weight={getCardWeight(feature)}>
					<FeatureCard {feature}/>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.masonry-layout {
		/* --column-count set dynamically via inline style or CSS media queries */
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(var(--column-count, 3), minmax(0, 1fr));
		width: 100%;
		max-width: 100%;
		overflow-x: hidden;
	}

	/* Responsive column behavior - only when not explicitly set via props */
	.masonry-layout.responsive {
		--column-count: 3;
	}

	@media (max-width: 768px) {
		.masonry-layout.responsive {
			--column-count: 2;
		}
	}

	@media (max-width: 480px) {
		.masonry-layout.responsive {
			--column-count: 1;
		}
	}

	.masonry-column {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		min-width: 0; /* Allow columns to shrink below content size */
	}

	.masonry-column:empty {
		display: none;
	}

	.masonry-item {
		break-inside: avoid;
		display: flex;
		position: relative;
		width: 100%;
		min-width: 0; /* Allow items to shrink below content size */
	}
</style>

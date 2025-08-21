<script lang="ts">
	import type { RawFeature, Feature } from '@atm/shared/types';
	import { featureViewerState } from '$lib/state/featureState.svelte';
	import { ArrowsOut } from 'phosphor-svelte';

	type Props = {
		feature: Feature;
		class?: string;
	};

	let { feature, class: className }: Props = $props();
	
	function handleExpandClick() {
		featureViewerState.openFeature(feature as Feature);
	}
</script>

<div class="border-t border-gray-300 p-2 {className || ''}">
	<!-- Tags -->
	{#if feature.tags && feature.tags.length > 0}
		<div class="flex flex-wrap gap-1 mb-2">
			{#each feature.tags.slice(0, 3) as tag}
				<span class="text-xs px-1 py-0.5 bg-gray-100 text-gray-700 rounded">
					{tag}
				</span>
			{/each}
			{#if feature.tags.length > 3}
				<span class="text-xs px-1 py-0.5 bg-gray-200 text-gray-600 rounded">
					+{feature.tags.length - 3}
				</span>
			{/if}
		</div>
	{/if}
	
	<!-- Actions -->
	<div class="flex justify-between items-center">
		{#if feature.url}
			<a 
				href={feature.url} 
				target="_blank" 
				rel="noopener noreferrer"
				class="text-xs text-blue-600 hover:text-blue-800 hover:underline"
			>
				Source →
			</a>
		{:else}
			<div></div>
		{/if}
		
		<button
			onclick={handleExpandClick}
			class="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-800 
			       hover:bg-gray-100 rounded transition-colors"
			aria-label="View feature details"
		>
			<ArrowsOut size={12} />
			Expand
		</button>
	</div>
</div>

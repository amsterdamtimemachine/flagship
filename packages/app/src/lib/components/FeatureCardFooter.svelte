<script lang="ts">
	import type { RawFeature, Feature } from '@atm/shared/types';
	import { featureViewerState } from '$lib/state/featureState.svelte';
	import { ArrowsOut, ArrowSquareOut } from 'phosphor-svelte';
	import {  formatDatasetTitle  } from '$utils/format';
	import { mergeCss } from '$utils/utils';
	import Button from '$components/Button.svelte';
	import Link from '$components/Link.svelte';

	type Props = {
		feature: Feature;
		class?: string;
	};

	let { feature, class: className }: Props = $props();
	
	function handleExpandClick() {
		featureViewerState.openFeature(feature as Feature);
	}
</script>

<div class={className}>
	<!-- Tags -->
	{#if feature.tags && feature.tags.length > 0}
		<div class="flex flex-wrap p-2 gap-1">
			{#each feature.tags.slice(0, 2) as tag}
				<span class="text-xs px-1 py-0.5 bg-gray-100 text-gray-700 rounded">
					{tag}
				</span>
			{/each}
			{#if feature.tags.length > 2}
				<span class="text-xs px-1 py-0.5 bg-gray-200 text-gray-600 rounded">
					+{feature.tags.length - 2}
				</span>
			{/if}
		</div>
	{/if}
	
	<!-- Actions -->
	<div class="px-2 py-1 flex justify-between items-center border-t border-gray-300 ">
		{#if feature.url}
			<Link 
				href={feature.url} 
				target="_blank" 
				rel="noopener noreferrer" 
				class="text-xs"
			>
				{formatDatasetTitle(feature.ds)}
			</Link>
		{/if}
		
		<Button
			onclick={handleExpandClick}
			icon={ArrowsOut}
			class="p-1"
			aria-label="View feature details"
		>
			Expand
		</Button>
	</div>
</div>

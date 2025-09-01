<script lang="ts">
	import type { RawFeature, Feature } from '@atm/shared/types';
	import { ArrowsOut, ArrowSquareOut, X } from 'phosphor-svelte';
	import {  formatDatasetTitle  } from '$utils/format';
	import { mergeCss } from '$utils/utils';
	import Button from '$components/Button.svelte';
	import Link from '$components/Link.svelte';

	type Props = {
		feature: Feature;
		class?: string;
		onExpand: () => void;
		expanded?: boolean;
	};

	let { feature, class: className, onExpand, expanded = false }: Props = $props();
</script>

<div class={mergeCss('px-2 py-1 flex justify-between items-center border-t border-gray-300', className)}>
		{#if feature.url}
			<Link 
				href={feature.url} 
				target="_blank" 
				rel="noopener noreferrer" 
				class="text-xs"
			>
				{formatDatasetTitle(feature.ds)} →
			</Link>
		{/if}
		
		{#if !expanded}
			<Button
				onclick={onExpand}
				icon={ArrowsOut}
				class="p-1"
				aria-label="View feature details"
			>
				Expand
			</Button>
		{/if}
</div>

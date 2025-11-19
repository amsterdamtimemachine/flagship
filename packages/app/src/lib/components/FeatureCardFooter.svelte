<script lang="ts">
	import type { RawFeature, Feature } from '@atm/shared/types';
	import { ArrowsOut, ArrowSquareOut, X } from 'phosphor-svelte';
	import { formatDatasetTitle } from '$utils/format';
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

<div
	class={mergeCss(
		expanded ? 'py-2' : 'py-1',
		'px-2 flex justify-between items-center border-t border-atm-sand-border',
		className
	)}
>
	{#if feature.url}
		<Link href={feature.url} target="_blank" rel="noopener noreferrer" class="text-base">
			{formatDatasetTitle(feature.ds)} →
		</Link>
	{/if}

	{#if !expanded}
		<Button onclick={onExpand} icon={ArrowsOut} aria-label="View feature details">Expand</Button>
	{/if}
</div>

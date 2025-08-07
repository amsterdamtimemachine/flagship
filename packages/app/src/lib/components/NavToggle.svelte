<script lang="ts">
	import { List, X } from 'phosphor-svelte';
	import { mergeCss } from '$utils/utils';

	interface Props {
		class?: string;
		isNavExpanded?: boolean;
	}

	let { class: className, isNavExpanded = false }: Props = $props();
</script>

<button
	type="button"
	class={mergeCss('p-2 pr-0 focus:outline-none', className)}
	aria-label={isNavExpanded ? 'Close navigation menu' : 'Open navigation menu'}
	onclick
>
	{#if isNavExpanded}
		<X weight="bold" size={24} />
	{:else}
		<List weight="bold" size={24} />
	{/if}
</button>

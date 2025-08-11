<script lang="ts">
	import { createTooltip, melt } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import type { Snippet } from 'svelte';

	interface Props {
		text?: string;
		placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
		openDelay?: number;
		closeDelay?: number;
		disabled?: boolean;
		class?: string;
		children?: Snippet;
		content?: Snippet;
	}

	let { 
		text,
		placement = 'top',
		openDelay = 500,
		closeDelay = 300,
		disabled = false,
		class: className,
		children,
		content: contentSnippet
	}: Props = $props();

	const {
		elements: { trigger, content: tooltipContent, arrow },
		states: { open },
	} = createTooltip({
		positioning: {
			placement,
		},
		openDelay,
		closeDelay,
		closeOnPointerDown: false,
		forceVisible: true,
		defaultOpen: false,
		portal: 'body'
	});
</script>

<!-- Trigger element -->
<span 
	use:melt={disabled ? undefined : $trigger} 
	class={className}
>
	{@render children?.()}
</span>

<!-- Tooltip content -->
{#if $open && !disabled}
	<div
		use:melt={$tooltipContent}
		transition:fade={{ duration: 150 }}
		class="tooltip-content z-50 max-w-xs rounded-lg bg-gray-900 text-white shadow-lg"
	>
		<div use:melt={$arrow} class="tooltip-arrow" />
		<div class="px-3 py-2 text-sm">
			{#if contentSnippet}
				{@render contentSnippet()}
			{:else if text}
				{text}
			{/if}
		</div>
	</div>
{/if}

<style lang="postcss">
	.tooltip-content {
		@apply border border-gray-700;
	}

	.tooltip-arrow {
		@apply bg-gray-900 border-gray-700;
	}
</style>
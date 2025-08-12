<script lang="ts">
	import { createTooltip, melt } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import type { Snippet, Component } from 'svelte';

	// Type for Phosphor icon props based on official documentation
	interface PhosphorIconProps {
		color?: string;
		size?: number | string;
		weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
		mirrored?: boolean;
	}

	// Type for Phosphor icon components
	type PhosphorIcon = Component<PhosphorIconProps>;

	interface Props {
		text?: string;
		placement?: 'top' | 'bottom' | 'left' | 'right' | 'top-start' | 'top-end' | 'bottom-start' | 'bottom-end' | 'left-start' | 'left-end' | 'right-start' | 'right-end';
		openDelay?: number;
		closeDelay?: number;
		disabled?: boolean;
		class?: string;
		// Only allow choosing the icon - styling is predefined
		icon: PhosphorIcon;
		content?: Snippet;
	}

	// Hardcoded icon styling for consistency
	const iconProps: PhosphorIconProps = {
		size: 26,
		weight: 'regular',
		color: 'white',
		mirrored: false
	};

	let { 
		text,
		placement = 'top',
		openDelay = 100,
		closeDelay = 300,
		disabled = false,
		class: className,
		icon,
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
	<svelte:component this={icon} {...iconProps} />
</span>

<!-- Tooltip content -->
{#if $open && !disabled}
	<div
		use:melt={$tooltipContent}
		transition:fade={{ duration: 100 }}
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

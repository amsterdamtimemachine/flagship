<script lang="ts">
	import { createTooltip, melt } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import type { Component } from 'svelte';

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
		text: string; // Required text for the tooltip
		icon: PhosphorIcon;
		placement?:
			| 'top'
			| 'bottom'
			| 'left'
			| 'right'
			| 'top-start'
			| 'top-end'
			| 'bottom-start'
			| 'bottom-end'
			| 'left-start'
			| 'left-end'
			| 'right-start'
			| 'right-end';
		openDelay?: number;
		closeDelay?: number;
		disabled?: boolean;
		class?: string;
	}

	// Hardcoded icon styling for consistency
	const iconProps: PhosphorIconProps = {
		size: 18,
		weight: 'bold',
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
		icon: Icon
	}: Props = $props();

	const {
		elements: { trigger, content, arrow },
		states: { open }
	} = createTooltip({
		positioning: {
			placement
		},
		openDelay,
		closeDelay,
		closeOnPointerDown: false,
		forceVisible: true,
		defaultOpen: false
	});
</script>

<!-- Trigger element -->
<span
	use:melt={disabled ? undefined : $trigger}
	class="inline-flex items-center justify-center w-6 h-6 bg-black rounded-full cursor-pointer hover:bg-gray-800 transition-colors {className}"
>
	<Icon {...iconProps} />
</span>

<!-- Tooltip content -->
{#if $open && !disabled}
	<div
		use:melt={$content}
		transition:fade={{ duration: 100 }}
		class="tooltip-content z-50 max-w-xs rounded-lg bg-gray-900 text-white shadow-lg"
	>
		<div use:melt={$arrow} class="tooltip-arrow"></div>
		<div class="px-3 py-2 text-sm">
			{text}
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

<script lang="ts">
	import { createTooltip, melt } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import type { PhosphorIcon, PhosphorIconProps } from '@atm/shared/types';

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
{#if disabled}
	<span class="inline-flex items-center justify-center w-6 h-6 bg-gray-300 rounded-full cursor-not-allowed {className}">
		<Icon {...iconProps} />
	</span>
{:else}
	<span
		use:melt={$trigger}
		class="inline-flex items-center justify-center w-6 h-6 bg-black rounded-full cursor-pointer hover:bg-gray-800 transition-colors {className}"
	>
		<Icon {...iconProps} />
	</span>
{/if}

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

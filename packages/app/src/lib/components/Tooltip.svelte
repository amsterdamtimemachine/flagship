<script lang="ts">
	import { createTooltip, melt } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import { mergeCss } from '$utils/utils';
	import type { PhosphorIcon, PhosphorIconProps } from '@atm/shared/types';

	interface Props {
		text: string; 
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

	const iconProps: PhosphorIconProps = {
		size: 15,
		weight: 'bold',
		color: 'black',
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
	<span class={mergeCss("inline-flex items-center justify-center w-5 h-5 bg-sand-li rounded-full cursor-not-allowed", className)}>
		<Icon {...iconProps} />
	</span>
{:else}
	<span
		use:melt={$trigger}
		class="inline-flex items-center justify-center w-5 h-5 bg-atm-sand-darkish rounded-full border border-atm-gold cursor-pointer hover:bg-atm-sand-dark transition-colors {className}"
	>
		<Icon {...iconProps} />
	</span>
{/if}

<!-- Tooltip content -->
{#if $open && !disabled}
	<div
		use:melt={$content}
		transition:fade={{ duration: 100 }}
		class="tooltip-content z-50 max-w-xs rounded-lg bg-gray-900 border border-gray-700 text-white shadow-lg"
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

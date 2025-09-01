<script lang="ts">
	import { createDialog, melt, type CreateDialogProps } from '@melt-ui/svelte';
	import { fade } from 'svelte/transition';
	import { featureViewerState } from '$lib/state/featureState.svelte';
	import { X } from 'phosphor-svelte';
	import type { Feature } from '@atm/shared/types';
	import FeatureCard from '$components/FeatureCard.svelte';
	
	let innerWidth = 0;
	let innerHeight = 0;
	
	
	const handleOpenChange: CreateDialogProps['onOpenChange'] = ({ next }) => {
		if (next === false && featureViewerState.selectedFeature) {
			featureViewerState.closeFeature();
		}
		return next;
	};
	
	const {
		elements: { overlay, content, title, close, portalled },
		states: { open }
	} = createDialog({
		forceVisible: true,
		defaultOpen: false,
		role: 'dialog',
		preventScroll: true,
		onOpenChange: handleOpenChange
	});
	
	// Get current selected feature
	let selectedFeature = $derived(featureViewerState.selectedFeature);
	
	// Open dialog when feature is selected
	$effect(() => {
		if (featureViewerState.selectedFeature) {
			open.set(true);
		} else {
			open.set(false);
		}
	});
</script>

<svelte:window bind:innerWidth bind:innerHeight />

{#if $open && selectedFeature}
	<div use:melt={$portalled}>
		<!-- Overlay/backdrop -->
		<div
			use:melt={$overlay}
			class="fixed inset-0 z-50 bg-black/75 flex items-center justify-center"
			transition:fade={{ duration: 150 }}
		>
			<button
				use:melt={$close}
				class="absolute flex items-center justify-center w-[45px] h-[45px] rounded-full
				       border border-gray-300 right-4 top-4 px-2 py-1 bg-white hover:bg-gray-100
				       transition-colors z-10"
				aria-label="Close feature detail viewer"
			>
				<X size={30} />
			</button>
		</div>
		
		<!-- Modal Content -->
		<div
			use:melt={$content}
			class="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-4xl max-h-[90vh] 
			       -translate-x-1/2 -translate-y-1/2 bg-white rounded-lg shadow-xl
			       overflow-hidden flex flex-col"
			transition:fade={{ duration: 150 }}
		>
			<!-- Hidden title for accessibility -->
			<h2 use:melt={$title} class="sr-only">Feature Detail Viewer</h2>
			
			<!-- Scrollable content area -->
			<div class="overflow-y-auto flex-1 p-6">
				<!-- Use FeatureCard in expanded mode -->
				<FeatureCard feature={selectedFeature} expanded={true} />
			</div>
		</div>
	</div>
{/if}

<style>
	/* Ensure proper scrolling behavior */
	:global(body.modal-open) {
		overflow: hidden;
	}
</style>

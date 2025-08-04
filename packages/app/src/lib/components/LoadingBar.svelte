<script lang="ts">
	import { Progress } from "melt/builders";
	import { loadingState } from '$state/loadingState.svelte';
	import { onDestroy } from 'svelte';
	import { mergeCss } from '$utils/utils';

	interface Props {
		class?: string;
	}

	let { 
		class: className = undefined,
	}: Props = $props();

	// Use melt-ui Progress builder
	const progress = new Progress({
		value: 0,
		max: 100
	});

	let animationId: number | null = null;
	let startTime: number | null = null;
	let isActive = $state(false);

	$effect(() => {
		if (loadingState.isLoading) {
			startLoading()
		} else {
			completeLoading();
		}
	});

	function startLoading() {
		if (isActive) return;
		
		isActive = true;
		progress.value = 0;
		startTime = performance.now();
		animate();
	}

	function completeLoading() {
		if (!isActive) return;
		
		progress.value = 100;
		
		setTimeout(() => {
			isActive = false;
			progress.value = 0;
			if (animationId) {
				cancelAnimationFrame(animationId);
				animationId = null;
			}
		}, 150);
	}

	function animate() {
		if (!isActive || !startTime) return;

		const elapsed = performance.now() - startTime;
		let newProgress = 0;
		
		if (elapsed < 200) {
			newProgress = (elapsed / 200) * 30;
		} else if (elapsed < 1000) {
			newProgress = 30 + ((elapsed - 200) / 800) * 40;
		} else {
			const remaining = 100 - 70;
			const slowFactor = Math.min((elapsed - 1000) / 5000, 0.8);
			newProgress = 70 + (remaining * slowFactor);
		}

		progress.value = Math.min(newProgress, 95);
		
		if (isActive) {
			animationId = requestAnimationFrame(animate);
		}
	}

	onDestroy(() => {
		isActive = false;
		if (animationId) {
			cancelAnimationFrame(animationId);
		}
	});

</script>
<div 
	{...progress.root} 
	class={mergeCss("w-full h-[3px]", className)}
	class:opacity-100={isActive}
	class:opacity-0={!isActive}
	style:transition="opacity 150ms ease-in-out"
>
	<div 
		{...progress.progress}
		class="h-full bg-blue-500 transition-transform duration-300 ease-out"
		style:width="calc(100% - var(--progress))"
		style:transform="translateX(calc(var(--progress) * -1))"
	></div>
</div>


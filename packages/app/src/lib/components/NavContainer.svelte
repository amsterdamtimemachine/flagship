<script lang="ts">
	import NavToggle from '$components/NavToggle.svelte';
	import { navigationHeight } from '$stores/layoutStore';
	import { cubicOut } from 'svelte/easing';
	import { tweened } from 'svelte/motion';
	import { mergeCss } from '$utils';
	import type { Snippet } from 'svelte';

	interface Props {
		class?: string;
		isExpanded: boolean;
		children?: Snippet;
	}

	let { class: className, isExpanded = $bindable(true), children }: Props = $props();

	let startingPosition = $derived(isExpanded ? 0 : -100);
	const navPosition = tweened(startingPosition, {
		duration: 200,
		easing: cubicOut
	});

	$effect(() => {
		navPosition.set(isExpanded ? 0 : -100);
	});

	function toggleToc() {
		isExpanded = !isExpanded;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' || event.key === 'Esc' || event.keyCode === 27) {
			isExpanded = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	id="table-of-contents-container"
	class={mergeCss(
		'left-0 fixed w-[300px] top-0 h-[100vh] xl:w-[290px] 2xl:w-[400px] border-r border-light-gray bg-white shadow-[5px_0px_20px_5px_rgba(0,0,0,0.07)]',
		className
	)}
	style="transform: translateX({$navPosition}%);"
	aria-hidden={!isExpanded}
>
	<NavToggle
		onclick={toggleToc}
		isNavExpanded={isExpanded}
		class="absolute right-[-30px] top-[50vh]"
	/>
	<div class="w-full h-full" inert={!isExpanded}>
		{@render children?.()}
	</div>
</div>

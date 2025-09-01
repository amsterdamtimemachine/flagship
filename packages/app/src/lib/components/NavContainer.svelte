<script lang="ts">
	import Button from '$components/Button.svelte';
	import { List, X } from 'phosphor-svelte';
	import { cubicOut } from 'svelte/easing';
	import { tweened } from 'svelte/motion';
	import { mergeCss } from '$utils/utils';
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
		'absolute left-0 top-0 w-[300px] h-full xl:w-[290px] 2xl:w-[400px] border-r border-gray-300 bg-white shadow-[5px_0px_20px_5px_rgba(0,0,0,0.07)]',
		className
	)}
	style="transform: translateX({$navPosition}%);"
	aria-hidden={!isExpanded}
>
	<Button
		onclick={toggleToc}
		icon={isExpanded ? X : List}
		class="absolute right-[-32px] top-[50%] h-[32px] w-[32px] rounded-l-none"
		size={18}
		aria-label={isExpanded ? 'Close navigation menu' : 'Open navigation menu'}
	/>
	<div class="w-full h-full p-4 space-y-4" inert={!isExpanded}>
		<h1>Amsterdam Time Machine</h1>
		{@render children?.()}
	</div>
</div>

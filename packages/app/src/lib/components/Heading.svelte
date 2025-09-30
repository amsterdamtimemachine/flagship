<script lang="ts">
	import { mergeCss } from '$utils/utils';

	interface Props {
		level?: 1 | 2 | 3 | 4 | 5 | 6;
		id?: string;
		style?: string;
		class?: string;
		children?: import('svelte').Snippet;
	}

	let { level = 1, id, style, class: className, children }: Props = $props();

	const levelStyles = {
		1: 'text-lg font-bold',
		2: 'text-base font-bold',
		3: 'text-lg font-light',
		4: 'text-base font-light',
		5: 'text-base font-light',
		6: 'text-base font-light'
	};
</script>

<svelte:element
	this={`h${level}`}
	{id}
	{style}
	class={mergeCss('block font-sans', levelStyles[level], className)}
>
	{@render children?.()}
</svelte:element>

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
		1: 'text-heading1Mobile md:text-heading1 font-semibold',
		2: 'text-heading2Mobile md:text-heading2 font-light',
		3: 'text-heading3Mobile md:text-heading3 font-light',
		4: 'text-heading4Mobile md:text-heading4 font-semibold',
		5: 'text-heading5Mobile md:text-heading5 font-semibold',
		6: 'text-heading6Mobile md:text-heading6 font-semibold'
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

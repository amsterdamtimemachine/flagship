<script lang="ts">
	import { mergeCss } from '$utils/utils';

	interface Props {
		href?: string; // For svelte-markdown compatibility (image src)
		src?: string; // Standard img src prop
		title?: string; // Image title
		text?: string; // For svelte-markdown compatibility (alt text)
		alt?: string; // Standard img alt prop
		class?: string;
		loading?: 'lazy' | 'eager';
	}

	let {
		href,
		src,
		title,
		text,
		alt,
		class: className,
		loading = 'lazy'
	}: Props = $props();

	// Use href from svelte-markdown if available, otherwise use src
	const imageSrc = href ?? src ?? '';
	// Use text from svelte-markdown if available, otherwise use alt
	const imageAlt = text ?? alt ?? '';

	const baseClasses = 'max-w-full h-auto rounded-md';
</script>

<img
	src={imageSrc}
	alt={imageAlt}
	{title}
	{loading}
	class={mergeCss(baseClasses, className)}
/>
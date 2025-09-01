<script lang="ts">
	import { mergeCss } from '$utils/utils';

	interface Props {
		class?: string;
		variant?: 'default' | 'count';
		children: import('svelte').Snippet;
	}

	let { 
		class: className,
		variant = 'default',
		children
	}: Props = $props();

	const baseClasses = 'text-xs px-1 py-0.5 rounded';
	const variantClasses = variant === 'count' 
		? 'bg-gray-200 text-gray-600' 
		: 'bg-gray-100 text-gray-700';
</script>

<span class={mergeCss(`${baseClasses} ${variantClasses}`, className)}>
	{@render children()}
</span>
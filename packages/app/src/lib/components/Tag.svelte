<script lang="ts">
	import { mergeCss } from '$utils/utils';

	interface Props {
		class?: string;
		variant?: 'default' | 'selected';
		disabled?: boolean;
		children: import('svelte').Snippet;
	}

	let { class: className, variant = 'default', disabled = false, children }: Props = $props();

	const baseClasses = 'text-xs px-1 py-0.5 rounded transition-colors select-none';

	let variantClasses = '';
	if (disabled) {
		variantClasses = 'bg-gray-100 text-gray-400';
	} else if (variant === 'selected') {
		variantClasses = 'bg-blue-100 text-blue-800';
	} else {
		variantClasses = 'bg-gray-100 text-gray-700';
	}
</script>

<span class={mergeCss(`${baseClasses} ${variantClasses}`, className)}>
	{@render children()}
</span>

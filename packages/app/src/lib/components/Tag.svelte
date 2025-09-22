<script lang="ts">
	import { mergeCss } from '$utils/utils';

	interface Props {
		class?: string;
		variant?: 'default' | 'selected' | 'outline' | 'selected-outline';
		disabled?: boolean;
		children: import('svelte').Snippet;
	}

	let { class: className, variant = 'default', disabled = false, children }: Props = $props();

	const baseClasses = 'text-sm px-1 py-0.5 rounded transition-colors select-none';

	const variantClasses = $derived(
		disabled
			? 'bg-atm-gold-gray text-gray-800'
			: variant === 'selected'
				? 'bg-atm-blue-light text-black'
				: variant === 'outline'
					? 'border border-atm-gold-gray-dark text-black bg-transparent'
					: variant === 'selected-outline'
						? 'border border-atm-blue text-black bg-transparent'
						: 'bg-atm-gold-gray text-black'
	);
</script>

<span class={mergeCss(`${baseClasses} ${variantClasses}`, className)}>
	{@render children()}
</span>

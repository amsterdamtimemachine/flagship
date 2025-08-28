<script lang="ts">
	import type { Component } from 'svelte';
	import { mergeCss } from '$utils/utils';

	interface PhosphorIconProps {
		color?: string;
		size?: number | string;
		weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
		mirrored?: boolean;
	}

	type PhosphorIcon = Component<PhosphorIconProps>;

	interface Props {
		icon: PhosphorIcon;
		onclick?: () => void;
		class?: string;
		disabled?: boolean;
		size?: number;
		weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
		color?: string;
	}

	let { 
		icon: Icon, 
		onclick, 
		class: className, 
		disabled = false,
		size = 24,
		weight = 'bold',
		color = 'currentColor'
	}: Props = $props();

	const iconProps: PhosphorIconProps = {
		size,
		weight,
		color,
		mirrored: false
	};
</script>

<button
	{onclick}
	{disabled}
	class={mergeCss('flex justify-center items-center bg-white rounded border border-gray-300 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed p-2', className)}
>
	<Icon {...iconProps} />
</button>
<script lang="ts">
	import { createSwitch, melt } from '@melt-ui/svelte';

	interface Props {
		operator: 'AND' | 'OR';
		onOperatorChange: (operator: 'AND' | 'OR') => void;
		disabled?: boolean;
	}

	let { operator, onOperatorChange, disabled = false }: Props = $props();

	const {
		elements: { root, input },
		states: { checked }
	} = createSwitch({
		defaultChecked: operator === 'AND',
		disabled,
		onCheckedChange: ({ next }) => {
			const newOperator = next ? 'AND' : 'OR';
			onOperatorChange(newOperator);
			return next;
		}
	});

	// Update checked state when operator prop changes
	$effect(() => {
		checked.set(operator === 'AND');
	});
</script>

<div class="flex items-center gap-3">
	<span class="text-xs text-neutral-600 select-none">OR</span>
	<button
		use:melt={$root}
		class="relative h-5 w-9 cursor-pointer rounded-full bg-neutral-300 transition-colors duration-200 ease-in-out
			   data-[state=checked]:bg-atm-blue 
			   data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50
			   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-atm-blue focus-visible:ring-offset-2"
		aria-label="Toggle between OR and AND search modes"
	>
		<span 
			class="thumb block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out"
		></span>
	</button>
	<input use:melt={$input} />
	<span class="text-xs text-neutral-600 select-none">AND</span>
</div>

<style>
	.thumb {
		transform: translateX(0.125rem);
	}

	:global([data-state='checked']) .thumb {
		transform: translateX(1.125rem);
	}
</style>
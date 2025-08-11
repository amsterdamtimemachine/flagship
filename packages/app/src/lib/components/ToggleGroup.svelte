<script lang="ts">
	import { createToggleGroup, melt } from '@melt-ui/svelte';
	import { Check } from 'phosphor-svelte';
	import { mergeCss } from '$utils/utils';

	interface Props {
		items: string[];
		orientation?: 'horizontal' | 'vertical';
		type?: 'single' | 'multiple';
		selectedItems?: string[];
		onItemSelected?: (selected: string[]) => void;
		class?: string;
	}

	let { items, 
		selectedItems = [], 
		orientation = 'vertical',
		type = 'multiple',
		onItemSelected,
		class: className
	}: Props = $props();

	const {
		elements: { root, item },
		states: { value }
	} = createToggleGroup({
		type,
		defaultValue: type === 'single' ? selectedItems[0] : selectedItems,
		orientation: orientation,
		onValueChange: ({curr, next}) => {
		  if(onItemSelected) {
		    onItemSelected(next);
		  }
		  return next 
		}
	});	
</script>

<div
	use:melt={$root}
	class={mergeCss("flex items-start data-[orientation='vertical']:flex-col data-[orientation='horizontal']:flex-row gap-3", className)}
	aria-label="Toggle selection"
	role={type === 'single' ? 'radiogroup' : 'group'}
>
	{#each items.sort() as itemValue (itemValue)}
		<button
			class="py-2 flex items-center gap-2 w-full text-left cursor-pointer transition-colors hover:bg-gray-50 focus:outline-none focus:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
			use:melt={$item(itemValue)}
			aria-label="Toggle {itemValue}"
			role={type === 'single' ? 'radio' : 'checkbox'}
			aria-checked={$value && $value.includes(itemValue) || (type === 'single' && $value === itemValue)}
		>
			<span 
				class="w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center bg-white text-blue-600 transition-colors data-[state='on']:border-blue-600 data-[state='on']:bg-blue-600 data-[state='on']:text-white"
				aria-hidden="true"
			>
				{#if $value && $value.includes(itemValue) || (type === 'single' && $value === itemValue)}
					<Check size={16} weight="bold" />
				{/if}
			</span>
			<span 
				class="text-sm text-gray-700 transition-colors select-none"
				aria-hidden="true"
			>
				{itemValue}
			</span>
		</button>
	{/each}
</div>


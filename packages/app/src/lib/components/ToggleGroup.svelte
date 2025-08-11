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
		onValueChange: ({_curr, next}) => {
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
	{#each items as itemValue}
		<div class="toggle-item flex items-center gap-2">
			<button
				class="checkbox-button"
				use:melt={$item(itemValue)}
				aria-label="Toggle {itemValue}"
				role={type === 'single' ? 'radio' : 'checkbox'}
			>
				{#if $value.includes(itemValue) || (type === 'single' && $value === itemValue)}
					<Check size={16} weight="bold" />
				{/if}
			</button>
			<button
				class="label-button"
				use:melt={$item(itemValue)}
				aria-label="Toggle {itemValue}"
			>
				{itemValue}
			</button>
		</div>
	{/each}
</div>


<style lang="postcss">
  .toggle-item {
    @apply py-2;
    
    &:hover .label-button {
      @apply text-blue-700;
    }
  }

  .checkbox-button {
    @apply w-5 h-5 border-2 border-gray-300 rounded flex items-center justify-center;
    @apply bg-white text-blue-600 transition-colors;
    @apply focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1;

    &:hover {
      @apply border-blue-400;
    }

    &[data-state='on'] {
      @apply border-blue-600 bg-blue-600 text-white;
    }
  }

  .label-button {
    @apply text-sm text-gray-700 bg-transparent border-none;
    @apply transition-colors cursor-pointer text-left;
    @apply focus:outline-none focus:text-blue-700;
    @apply p-0 m-0;
  }

  .toggle-item[data-disabled] {
    @apply cursor-not-allowed opacity-50;
    
    .checkbox-button {
      @apply cursor-not-allowed;
    }
    
    .label-button {
      @apply cursor-not-allowed;
    }
  }
</style>

<script lang="ts">
	import { createToggleGroup, melt } from '@melt-ui/svelte';
	import { mergeCss } from '$utils/utils';

	interface Props {
		items: string[];
		orientation: 'vertical';
		type?: 'single' | 'multiple';
		selectedItems?: string[];
		onItemSelected?: (selected: string[]) => void;
		className?: string;
	}

	let { items, 
				selectedItems = [], 
				orientation = 'horizontal',
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
		orientation: orientation 
	});

	// Watch value store and call parent callback when it changes
	$effect(() => {
		if ($value !== selectedItems) {
		  onItemSelected?.($value);
		}
	});
</script>

<div
	use:melt={$root}
	class={mergeCss("flex items-center data-[orientation='vertical']:flex-col", className)}
	aria-label="Toggle selection"
>
	{#each items as itemValue}
		<button
			class="toggle-item"
			use:melt={$item(itemValue)}
			aria-label="Toggle {itemValue}"
		>
			{itemValue}
		</button>
	{/each}
</div>


<style lang="postcss">
  .toggle-item {
    display: grid;
    place-items: center;
    align-items: center;

    background-color: theme('colors.white');
    color: theme('colors.blue.800');
    font-size: theme('fontSize.base');
    line-height: theme('lineHeight.4');
    outline: none;

    height: theme('height.9');

    &:hover {
      background-color: theme('colors.blue.100');
    }

    &:focus {
      z-index: 10;
    }
  }

  .toggle-item[data-disabled] {
    @apply cursor-not-allowed;
  }

  .toggle-item[data-orientation='horizontal'] {
    @apply border border-blue-500;
    @apply mx-1;
    @apply p-2;

    &:first-child {
      @apply mx-0;
    }

    &:last-child {
      @apply mx-0;
    }
  }

  .toggle-item[data-orientation='horizontal']:dir(rtl) {
    @apply border border-blue-500;
    @apply mx-1;
    @apply p-2;

    &:first-child {
      @apply mx-0;
    }

    &:last-child {
      @apply mx-0;
    }
  }

  .toggle-item[data-orientation='vertical'] {
    @apply border border-blue-500;
    @apply my-1;
    @apply p-2;
    @apply w-full;

    &:first-child {
      @apply my-0;
    }

    &:last-child {
      @apply my-0;
    }
  }

  .toggle-item[data-state='on'] {
    @apply bg-blue-700 text-white;
  }
</style>

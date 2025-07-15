<script lang="ts">
	import { createToggleGroup, melt } from '@melt-ui/svelte';
	import { mergeCss } from '$utils/utils';

	interface Props {
		items: string[];
		selectedItems?: string[];
		onItemSelected?: (selected: string[]) => void;
		className?: string;
	}

	let { items, 
				selectedItems = [], 
				onItemSelected,
				class: className
			}: Props = $props();
	
	const {
		elements: { root, item },
		states: { value }
	} = createToggleGroup({
		type: 'multiple',
		defaultValue: selectedItems,
		onValueChange: ({curr, next}) => {
			if(onItemSelected) {
				console.log("change");
				onItemSelected(next);
			}
			return next; 
		},
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
    @apply border-x border-l-transparent border-r-blue-200;

    &:first-child {
      @apply rounded-l-md;
    }

    &:last-child {
      @apply rounded-r-md border-r-transparent;
    }
  }

  .toggle-item[data-orientation='horizontal']:dir(rtl) {
    @apply border-x border-l-blue-200 border-r-transparent;

    &:first-child {
      @apply rounded-r-md;
    }

    &:last-child {
      @apply rounded-l-md border-l-transparent;
    }
  }

  .toggle-item[data-orientation='vertical'] {
    @apply border-y border-b-blue-200 border-t-transparent;

    &:first-child {
      @apply rounded-t-md;
    }

    &:last-child {
      @apply rounded-b-md border-b-transparent;
    }
  }

  .toggle-item[data-state='on'] {
    @apply bg-blue-200 text-blue-900;
  }
</style>

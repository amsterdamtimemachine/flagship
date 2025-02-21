<script lang="ts">
  import { createRadioGroup, melt } from '@melt-ui/svelte';
  import type { ContentClass, ContentClassStats } from '@atm/shared-types';

  export let featuresStatistics: { 
    contentClasses: Record<ContentClass, ContentClassStats> 
  };
  export let selected: ContentClass = 'Image'; // default to Image

  const contentClasses = Object.entries(featuresStatistics.contentClasses)
    .filter(([_, stats]) => stats.total > 0)
    .map(([className]) => className);

  const {
    elements: { root, item, hiddenInput },
    helpers: { isChecked },
    states: { value }
  } = createRadioGroup({
    defaultValue: selected
  });

  // Two-way binding
  $: selected = $value;
  $: if (selected !== $value) {
    value.set(selected);
  }
</script>

<div
  use:melt={$root}
  class="flex items-center gap-4"
  aria-label="Content class selection"
>
  {#each contentClasses as className}
    <div class="flex items-center gap-2">
      <button
        use:melt={$item(className)}
        class="grid h-5 w-5 place-items-center rounded-full border border-gray-300 bg-white hover:bg-gray-50"
        aria-labelledby="{className}-label"
      >
        {#if $isChecked(className)}
          <div class="h-3 w-3 rounded-full bg-blue-500" />
        {/if}
      </button>
      <label
        class="text-sm font-medium text-gray-700"
        id="{className}-label"
      >
        {className} ({featuresStatistics.contentClasses[className].total})
      </label>
    </div>
  {/each}
  <input use:melt={$hiddenInput} />
</div>

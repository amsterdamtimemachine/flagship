<script lang="ts">
  import { createToggleGroup, melt } from '@melt-ui/svelte';
  import { mergeCss } from '$utils/utils';
  import type { BinaryMetadata, ContentClass, ContentClassStats } from '@atm/shared-types';
  
  export let featuresStatistics: BinaryMetadata['featuresStatistics'];
  export let selected: Set<ContentClass> = new Set(['Image']);
  let styles : string | undefined = undefined;
  export {styles as class}

  const { elements: { root, item }, states: { value: toggleValue } } = createToggleGroup({
    type: 'multiple',
  });

  $: contentClasses = Object.entries(featuresStatistics.contentClasses)
    .filter(([_, stats]) => stats.total > 0)
    .map(([className]) => className);

  $: selected = new Set($toggleValue);
  
  $: selectedClass = [...selected][0];
  $: aiTags = selectedClass ? 
    Object.entries(featuresStatistics.contentClasses[selectedClass]?.ai?.tags?.tags || {})
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count) : 
    [];

  $: if (selected !== new Set($toggleValue)) {
    toggleValue.set([...selected]);
  }
</script>

<div class="flex flex-col gap-4">
  <div
    use:melt={$root}
    class={mergeCss("flex items-center data-[orientation='horizontal']:flex-row", styles)}
    aria-label="Content class selection"
  >
    {#each contentClasses as className}
      <button
        class="px-4 py-2 bg-white text-gray-700 border-x border-gray-200 first:rounded-l-md last:rounded-r-md first:border-l hover:bg-gray-100 data-[state='on']:bg-gray-200 data-[state='on']:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10"
        use:melt={$item(className)}
        aria-label="Select {className}"
      >
        {className} ({featuresStatistics.contentClasses[className].total})
      </button>
    {/each}
  </div>

  {#if selectedClass && aiTags.length > 0}
    <div class="flex items-center flex-wrap gap-2">
      {#each aiTags as {tag, count}}
        <button
          class="px-3 py-1 bg-white text-sm text-gray-600 border border-gray-200 rounded-full hover:bg-gray-100 data-[state='on']:bg-gray-200 data-[state='on']:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {tag} ({count})
        </button>
      {/each}
    </div>
  {/if}
</div>

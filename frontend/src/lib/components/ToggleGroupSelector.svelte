<script lang="ts">
  import { createToggleGroup, melt } from '@melt-ui/svelte';
  import { mergeCss } from '$utils/utils';
  import type { BinaryMetadata, ContentClass } from '@atm/shared-types';

  interface Props {
    featuresStatistics: BinaryMetadata['featuresStatistics'];
    initialSelectedClasses?: ContentClass[]; 
    initialSelectedTags?: string[];
    class?: string | undefined;
    onClassesChange?: (classes: ContentClass[]) => void;
    onTagsChange?: (tags: string[]) => void;
  }

  let {
    featuresStatistics,
    initialSelectedClasses = ['Image'], 
    initialSelectedTags = [],
    class: styles = undefined,
    onClassesChange,
    onTagsChange
  } = $props();

  // Content classes with items > 0
  const contentClasses = $derived(Object.entries(featuresStatistics.contentClasses)
    .filter(([_, stats]) => stats.total > 0)
    .map(([className]) => className));

  // Create toggle groups with initial values
  const {
    elements: { root: classRoot, item: classItem },
    states: { value: classValue }
  } = createToggleGroup({
    type: 'multiple',
    defaultValue: initialSelectedClasses
  });

  const {
    elements: { root: tagRoot, item: tagItem },
    states: { value: tagValue }
  } = createToggleGroup({
    type: 'multiple',
    defaultValue: initialSelectedTags
  });

  // Effect to notify parent when classes change
  $effect(() => {
    // Get the actual value from the store
    const selectedClasses = classValue.get();
    
    if (onClassesChange) {
      onClassesChange(selectedClasses);
    }
    
    // Reset tag selection when class selection changes
    if (selectedClasses.length > 0) {
      tagValue.set([]);
    }
  });

  // Effect to notify parent when tags change
  $effect(() => {
    // Get the actual value from the store
    const selectedTags = tagValue.get();
    
    if (onTagsChange) {
      onTagsChange(selectedTags);
    }
  });

  // Compute intersection tags based on currently selected classes
  const intersectionTags = $derived(
    findIntersectionTags(classValue.get(), featuresStatistics).slice(0, 10)
  );

  // Tag utilities remain the same
  function getTagsForClass(
    contentClass: ContentClass,
    statistics: BinaryMetadata['featuresStatistics']
  ) {
    const classStats = statistics.contentClasses[contentClass];
    if (!classStats?.ai?.tags?.tags) return new Map<string, number>();

    return new Map(Object.entries(classStats.ai.tags.tags));
  }

  function findIntersectionTags(
    classes: ContentClass[],
    statistics: BinaryMetadata['featuresStatistics']
  ) {
    // Same implementation as before
    if (classes.length === 0) return [];

    if (classes.length === 1) {
      const tagsMap = getTagsForClass(classes[0], statistics);
      return Array.from(tagsMap.entries())
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
    }

    const tagsFromClasses = classes.map((cls) => getTagsForClass(cls, statistics));
    const firstTags = tagsFromClasses[0];
    const intersectionMap = new Map<string, number>();

    for (const [tag, count] of firstTags.entries()) {
      const isInAll = tagsFromClasses.every((classTags) => classTags.has(tag));
      if (isInAll) {
        const totalCount = tagsFromClasses.reduce(
          (sum, classTags) => sum + (classTags.get(tag) || 0),
          0
        );
        intersectionMap.set(tag, totalCount);
      }
    }

    return Array.from(intersectionMap.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);
  }
</script>

<div class="z-10 top-[20px] left-[20px] absolute flex flex-col space-y-4">
  <div
    use:melt={$classRoot}
    class={mergeCss("db flex items-center data-[orientation='horizontal']:flex-row", styles)}
    aria-label="Content class selection"
  >
    {#each contentClasses as className}
      <button
        class="px-4 py-2 bg-white text-gray-700 border-x border-gray-200 first:rounded-l-md last:rounded-r-md first:border-l hover:bg-gray-100 data-[state='on']:bg-indigo-600 data-[state='on']:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:z-10"
        use:melt={$classItem(className)}
        aria-label="Select {className}"
      >
        {className} ({featuresStatistics.contentClasses[className].total})
      </button>
    {/each}
  </div>

  {#if classValue.get().length > 0 && intersectionTags.length > 0}
    <div 
      use:melt={$tagRoot} 
      class="db flex items-center flex-wrap gap-2 mt-2" 
      aria-label="Tag selection"
    >
      {#each intersectionTags as { tag, count }}
        <button
          class="px-3 py-1 bg-white text-sm text-gray-600 border border-gray-200 rounded-full hover:bg-gray-100 data-[state='on']:bg-indigo-600 data-[state='on']:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          use:melt={$tagItem(tag)}
          aria-label="Select tag {tag}"
        >
          {tag} ({count})
        </button>
      {/each}
    </div>
  {/if}
</div>

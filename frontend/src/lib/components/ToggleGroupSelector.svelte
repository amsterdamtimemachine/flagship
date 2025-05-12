<script lang="ts">
	import { run } from 'svelte/legacy';

	import { createToggleGroup, melt } from '@melt-ui/svelte';
	import { mergeCss } from '$utils/utils';
	import type { BinaryMetadata, ContentClass } from '@atm/shared-types';

	interface Props {
		featuresStatistics: BinaryMetadata['featuresStatistics'];
		selected?: Set<ContentClass>;
		selectedTags?: Set<string>;
		class?: string | undefined;
	}

	let {
		featuresStatistics,
		selected = $bindable(new Set()),
		selectedTags = $bindable(new Set()),
		class: styles = undefined
	}: Props = $props();
	

	const {
		elements: { root: classRoot, item: classItem },
		states: { value: classValue }
	} = createToggleGroup({
		type: 'multiple',
		defaultValue: ['Image']
	});

	const {
		elements: { root: tagRoot, item: tagItem },
		states: { value: tagValue }
	} = createToggleGroup({
		type: 'multiple'
	});






	/**
	 * Gets all tags for a single content class
	 */
	function getTagsForClass(
		contentClass: ContentClass,
		statistics: BinaryMetadata['featuresStatistics']
	) {
		const classStats = statistics.contentClasses[contentClass];
		if (!classStats?.ai?.tags?.tags) return new Map<string, number>();

		return new Map(Object.entries(classStats.ai.tags.tags));
	}

	/**
	 * Finds intersection of tags between multiple content classes
	 */
	function findIntersectionTags(
		classes: ContentClass[],
		statistics: BinaryMetadata['featuresStatistics']
	) {
		if (classes.length === 0) return [];

		// For a single class, return all its tags
		if (classes.length === 1) {
			const tagsMap = getTagsForClass(classes[0], statistics);
			return Array.from(tagsMap.entries())
				.map(([tag, count]) => ({ tag, count }))
				.sort((a, b) => b.count - a.count);
		}

		// For multiple classes, find tags common to all classes
		const tagsFromClasses = classes.map((cls) => getTagsForClass(cls, statistics));
		const firstTags = tagsFromClasses[0];
		const intersectionMap = new Map<string, number>();

		// Find tags that exist in all classes
		for (const [tag, count] of firstTags.entries()) {
			const isInAll = tagsFromClasses.every((classTags) => classTags.has(tag));

			if (isInAll) {
				// Sum the counts from all classes
				const totalCount = tagsFromClasses.reduce(
					(sum, classTags) => sum + (classTags.get(tag) || 0),
					0
				);
				intersectionMap.set(tag, totalCount);
			}
		}

		// Convert to array and sort by count
		return Array.from(intersectionMap.entries())
			.map(([tag, count]) => ({ tag, count }))
			.sort((a, b) => b.count - a.count);
	}
	let contentClasses = $derived(Object.entries(featuresStatistics.contentClasses)
		.filter(([_, stats]) => stats.total > 0)
		.map(([className]) => className));
	run(() => {
		selected = new Set($classValue);
	});
	run(() => {
		selectedTags = new Set($tagValue);
	});
	let selectedClasses = $derived([...selected]);
	let intersectionTags = $derived(findIntersectionTags(selectedClasses, featuresStatistics).slice(0, 10));
	// Reset tag selection when class selection changes
	run(() => {
		if (selectedClasses.length > 0) {
			tagValue.set([]);
		}
	});
	run(() => {
		if (selected !== new Set($classValue)) {
			classValue.set([...selected]);
		}
	});
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

	{#if selectedClasses.length > 0 && intersectionTags.length > 0}
		<div use:melt={$tagRoot} class="db flex items-center flex-wrap gap-2 mt-2" aria-label="Tag selection">
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

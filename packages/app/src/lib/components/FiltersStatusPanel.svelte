<script lang="ts">
	import { mergeCss } from '$utils/utils';
	import Tag from './Tag.svelte';
	import type { RecordType } from '@atm/shared/types';

	interface Props {
		selectedRecordTypes: RecordType[];
		allRecordTypes: RecordType[];
		selectedTags: string[];
		class?: string;
	}

	let { selectedRecordTypes, allRecordTypes, selectedTags, class: className }: Props = $props();

	// Generate content types part (OR logic)
	const contentTypesText = $derived.by(() => {
		if (selectedRecordTypes.length === 0 || 
			(selectedRecordTypes.length === allRecordTypes.length && 
			 allRecordTypes.every(type => selectedRecordTypes.includes(type)))) {
			return 'all content types';
		} else if (selectedRecordTypes.length === 1) {
			return selectedRecordTypes[0];
		} else {
			const lastType = selectedRecordTypes[selectedRecordTypes.length - 1];
			const otherTypes = selectedRecordTypes.slice(0, -1);
			return `${otherTypes.join(' or ')} or ${lastType}`;
		}
	});
</script>

<div class={mergeCss("bg-white border border-gray-300 rounded-md shadow-sm p-3", className)}>
	<div class="text-sm text-gray-700 leading-relaxed flex flex-wrap items-center gap-1">
		<span>{contentTypesText}</span>
		{#if selectedTags.length > 0}
			<span>and</span>
			{#each selectedTags as tag}
				<Tag variant="selected">{tag}</Tag>
			{/each}
		{/if}
	</div>
</div>

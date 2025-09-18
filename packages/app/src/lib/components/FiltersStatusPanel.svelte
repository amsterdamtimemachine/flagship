<script lang="ts">
	import { mergeCss } from '$utils/utils';
	import Tag from './Tag.svelte';
	import type { RecordType } from '@atm/shared/types';

	interface Props {
		selectedRecordTypes: RecordType[];
		allRecordTypes: RecordType[];
		selectedTags: string[];
		tagOperator?: 'AND' | 'OR';
		class?: string;
	}

	let { selectedRecordTypes, allRecordTypes, selectedTags, tagOperator = 'OR', class: className }: Props = $props();

	// Check if all content types are selected
	const hasAllTypes = $derived(
		selectedRecordTypes.length === 0 || 
		(selectedRecordTypes.length === allRecordTypes.length && 
		 allRecordTypes.every(type => selectedRecordTypes.includes(type)))
	);

	// Get content types to display
	const displayedRecordTypes = $derived(
		hasAllTypes ? allRecordTypes : selectedRecordTypes
	);
</script>

<div class={mergeCss("bg-atm-sand border border-atm-sand-border rounded-sm shadow-sm p-1", className)}>
	<div class="text-sm font-sans text-black flex flex-wrap items-center gap-1">
		<span>Viewing</span>
		{#each displayedRecordTypes as recordType, index}
			<Tag variant="selected-outline">{recordType}</Tag>
			{#if index < displayedRecordTypes.length - 1}
				<span>or</span>
			{/if}
		{/each}
		{#if selectedTags.length > 0}
			<span>{tagOperator === 'AND' ? 'and' : 'or'}</span>
			{#each selectedTags as tag, index}
				<Tag variant="selected">{tag}</Tag>
				{#if index < selectedTags.length - 1}
					<span>{tagOperator === 'AND' ? 'and' : 'or'}</span>
				{/if}
			{/each}
		{/if}
	</div>
</div>

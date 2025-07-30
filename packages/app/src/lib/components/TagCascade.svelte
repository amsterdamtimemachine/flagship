<!-- src/lib/components/TagCascade.svelte -->
<script lang="ts">
	import { onMount } from 'svelte';
	import ToggleGroup from './ToggleGroup.svelte';
	import { fetchTagCombinations } from '$utils/clientApi';
	import type { RecordType } from '@atm/shared/types';
	
	interface Props {
		recordTypes: RecordType[];
		selectedTags: string[];
		onTagsSelected: (tags: string[]) => void;
		maxColumns?: number;
		class?: string;
	}
	
	interface ColumnState {
		level: number;
		availableTags: Array<{ name: string; totalFeatures: number }>;
	}
	
	let { 
		recordTypes, 
		selectedTags, 
		onTagsSelected,
		maxColumns = 3,
		class: className = ''
	}: Props = $props();
	
	// Component state for displaying available tags (not selection state)
	let columns = $state<ColumnState[]>([]);
	
	// Derived visible columns (only show columns that have data)
	let visibleColumns = $derived(
		columns.filter(col => col.availableTags.length > 0)
	);
	
	// Load columns based on current selection and recordTypes
	$effect(() => {
		if (recordTypes) {
			loadColumnsForSelection();
		}
	});
	
	async function loadColumn(level: number, selectionPath: string[]) {
		try {
			const data = await fetchTagCombinations({
				recordTypes,
				selectedTags: selectionPath
			});
			
			columns[level] = {
				level,
				availableTags: data.availableTags
			};
			
		} catch (error) {
			console.error(`Failed to load column ${level}:`, error);
			columns[level] = {
				level,
				availableTags: [],
				error: error instanceof Error ? error.message : 'Failed to load tags'
			};
		}
	}
	
	function loadColumnsForSelection() {
		columns = [];
		
		// Load first column (base tags)
		loadColumn(0, []);
		
		// Load subsequent columns based on current selection
		for (let i = 0; i < selectedTags.length && i < maxColumns - 1; i++) {
			const selectionPath = selectedTags.slice(0, i + 1);
			loadColumn(i + 1, selectionPath);
		}
	}
	
	function handleColumnSelection(level: number, selectedItems: string[]) {
		const selectedTag = selectedItems[0]; // Single selection mode
		
		if (!selectedTag) {
			// Deselection - build new selection without this level
			const newSelection = selectedTags.slice(0, level);
			onTagsSelected(newSelection);
			return;
		}
		
		// Build new selection including this choice
		const newSelection = [...selectedTags.slice(0, level), selectedTag];
		onTagsSelected(newSelection);
	}
</script>

<div class={`flex gap-4 ${className}`}>
	{#each visibleColumns as column, index}
		<div class="flex flex-col min-w-48">
			<!-- Column header -->
			<div class="mb-2 text-sm font-medium text-gray-600">
				{#if index === 0}
					Base Tags
				{:else}
					+ Tag {index + 1}
				{/if}
			</div>
			
			<!-- Column content -->
			{#if column.availableTags.length === 0}
				<div class="p-4 text-gray-500 text-sm">
					No additional tags available
				</div>
			{:else}
				<ToggleGroup
					items={column.availableTags.map(tag => tag.name)}
					selectedItems={selectedTags[index] ? [selectedTags[index]] : []}
					onItemSelected={(selected) => handleColumnSelection(index, selected)}
					orientation="vertical"
					type="single"
				/>
			{/if}
		</div>
	{/each}
	
</div>

<style lang="postcss">
	/* Add any specific styling for the cascade component */
</style>

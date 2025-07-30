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
		maxColumns = 4,
		class: className = ''
	}: Props = $props();
	
	// Component state for displaying available tags (not selection state)
	let columns = $state<ColumnState[]>([]);
	
	// Derived visible columns (only show columns that have data)
	let visibleColumns = $derived(
		columns.filter(col => col.availableTags.length > 0)
	);
	
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
	
	function handleColumnSelection(level: number, selected: string) {
		
		// Clear columns beyond current level immediately to prevent stale UI
		columns = columns.slice(0, level + 1);
		
		if (!selected) {
			// Deselection - build new selection without this level
			const newSelection = selectedTags.slice(0, level);
			onTagsSelected(newSelection);
			return;
		}
		
		// Build new selection including this choice
		const newSelection = [...selectedTags.slice(0, level), selected];
		onTagsSelected(newSelection);
	}
</script>

<div class={`flex gap-4 ${className}`}>
	{#each visibleColumns as column, index}
		<div class="flex flex-col min-w-48">
				<ToggleGroup
					items={column.availableTags.map(tag => tag.name)}
					selectedItems={selectedTags[index] ? [selectedTags[index]] : []}
					onItemSelected={(selected) => handleColumnSelection(index, selected)}
					orientation="vertical"
					type="single"
				/>
		</div>
	{/each}
	
</div>

<style lang="postcss">
	/* Add any specific styling for the cascade component */
</style>

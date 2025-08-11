<script lang="ts">
	import ToggleGroup2 from './ToggleGroup2.svelte';
	import { fetchTagCombinations } from '$utils/clientApi';
	import type { RecordType } from '@atm/shared/types';
	
	interface Props {
		recordTypes: RecordType[]; // Currently selected record types
		allRecordTypes: RecordType[]; // All available record types from metadata
		availableTags: string[]; // All available tags from metadata
		selectedTags: string[]; // Currently selected tags
		onTagsSelected: (selected: string[]) => void;
		class?: string;
	}
	
	let { 
		recordTypes,
		allRecordTypes,
		availableTags,
		selectedTags,
		onTagsSelected,
		class: className = ''
	}: Props = $props();
	
	// Tag combination state
	let availableTagsForSelection = $state<string[]>([]);
	
	// Filter selectedTags to only include valid tags that exist in availableTags
	let validSelectedTags = $derived(
		selectedTags.filter(tag => availableTags.includes(tag))
	);
	
	let disabledTags = $derived.by(() => {
		// All tags that are NOT available for current selection should be disabled
		// But never disable currently selected tags
		return availableTags.filter(tag => 
			!availableTagsForSelection.includes(tag) && !validSelectedTags.includes(tag)
		);
	});
	
	// Effect to load available tag combinations when record types or current tags change
	$effect(() => {
		if (allRecordTypes.length > 0) {
			loadAvailableTagCombinations();
		} else {
			// When no record types available, show all tags as available
			availableTagsForSelection = availableTags;
		}
	});
	
	async function loadAvailableTagCombinations() {
		try {
			// Use the "show all" exception: if no current record types, use all record types
			const effectiveRecordTypes = recordTypes.length > 0 ? recordTypes : allRecordTypes;
			
			const data = await fetchTagCombinations({
				recordTypes: effectiveRecordTypes,
				selectedTags: validSelectedTags || []
			});
			
			availableTagsForSelection = data.availableTags.map(tag => tag.name);
			
		} catch (error) {
			console.error('Failed to load available tag combinations:', error);
			// On error, show all tags as available
			availableTagsForSelection = availableTags;
		}
	}
	
	// Validate tags before emitting to parent
	function handleTagSelection(selected: string[]) {
		console.log('🔄 TagsSelector2 handleTagSelection called');
		console.log('📥 Received selected:', selected);
		console.log('📋 Available tags:', availableTags);
		
		// Filter to only valid tags that exist in availableTags
		const validSelected = selected.filter(tag => availableTags.includes(tag));
		
		console.log('✅ Valid selected (after filter):', validSelected);
		console.log('❌ Invalid tags filtered out:', selected.filter(tag => !availableTags.includes(tag)));
		
		onTagsSelected(validSelected);
		console.log('📤 Emitted to parent:', validSelected);
	}
</script>

<div class={className}>
	{#if availableTags.length === 0}
		<div class="text-sm text-gray-500">No tags available</div>
	{:else}
		<ToggleGroup2
			items={availableTags}
			selectedItems={validSelectedTags}
			disabledItems={disabledTags}
			onItemSelected={handleTagSelection}
			orientation="vertical"
			type="multiple"
		/>
	{/if}
</div>
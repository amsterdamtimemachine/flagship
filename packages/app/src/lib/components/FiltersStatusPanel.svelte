<script lang="ts">
	import { mergeCss } from '$utils/utils';
	import type { RecordType } from '@atm/shared/types';

	interface Props {
		selectedRecordTypes: RecordType[];
		allRecordTypes: RecordType[];
		selectedTags: string[];
		class?: string;
	}

	let { selectedRecordTypes, allRecordTypes, selectedTags, class: className }: Props = $props();

	// Generate conversational description
	const conversationalDescription = $derived.by(() => {
		// Handle content types (OR logic)
		let contentPart = '';
		if (selectedRecordTypes.length === 0 || selectedRecordTypes.length === allRecordTypes.length) {
			contentPart = 'all content';
		} else if (selectedRecordTypes.length === 1) {
			contentPart = selectedRecordTypes[0];
		} else {
			const lastType = selectedRecordTypes[selectedRecordTypes.length - 1];
			const otherTypes = selectedRecordTypes.slice(0, -1);
			contentPart = `${otherTypes.join(', ')}, or ${lastType}`;
		}

		// Handle topics (AND logic)
		let topicsPart = '';
		if (selectedTags.length === 0) {
			// No topic filter - show all
			topicsPart = '';
		} else if (selectedTags.length === 1) {
			topicsPart = ` related to ${selectedTags[0]}`;
		} else if (selectedTags.length === 2) {
			topicsPart = ` related to both ${selectedTags[0]} & ${selectedTags[1]}`;
		} else {
			const lastTag = selectedTags[selectedTags.length - 1];
			const otherTags = selectedTags.slice(0, -1);
			topicsPart = ` related to ${otherTags.join(', ')}, & ${lastTag}`;
		}

		return `Viewing: ${contentPart}${topicsPart}`;
	});

	// Check if we have active filters
	const hasActiveFilters = $derived(
		(selectedRecordTypes.length > 0 && selectedRecordTypes.length < allRecordTypes.length) ||
		selectedTags.length > 0
	);
</script>

<div class={mergeCss("bg-white border border-gray-300 rounded-md shadow-sm p-3", className)}>
	<div class="text-sm text-gray-700 leading-relaxed">
		{conversationalDescription}
	</div>
</div>

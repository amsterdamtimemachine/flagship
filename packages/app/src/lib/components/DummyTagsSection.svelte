<script lang="ts">
	import { QuestionMark } from 'phosphor-svelte';
	import Heading from '$components/Heading.svelte';
	import Tooltip from '$components/Tooltip.svelte';
	import TagOperatorSwitch from '$components/TagOperatorSwitch.svelte';
	import ToggleGroup from '$components/ToggleGroup.svelte';
	import Tag from '$components/Tag.svelte';

	// Hardcoded dummy tags for preview purposes
	const DUMMY_TAGS = [
		'Politics', 
		'Economy', 
		'Culture', 
		'Science', 
		'Sports', 
		'Weather',
		'Society',
		'Technology'
	];
	
	// Fixed operator for simplicity
	const currentTagOperator = 'OR';
	
	// No-op handlers since everything is disabled
	function handleTagOperatorChange(operator: 'AND' | 'OR') {
		// Disabled - no action
	}
	
	function handleTagsChange(tags: string | string[]) {
		// Disabled - no action  
	}
</script>

<div class="mb-4">
	<div class="flex">
		<Heading level={3} class="pr-2"> Topics </Heading>
		<Tooltip icon={QuestionMark} text="Thematic categories based on newspaper sections, applied across all data using machine learning. [Preview - Feature coming soon]" placement="bottom" />
	</div>
	<div class="mt-2 mb-3">
		<TagOperatorSwitch 
			operator={currentTagOperator}
			onOperatorChange={handleTagOperatorChange}
			disabled={true}
			class="block"
		/>
		<span class="text-xs text-gray-400">
			Include content with any selected topics (Preview mode - disabled)
		</span>
	</div>
</div>

<!-- Always show OR version since it's simpler for preview -->
<ToggleGroup
	items={DUMMY_TAGS}
	selectedItems={[]}
	disabledItems={DUMMY_TAGS}
	onItemSelected={handleTagsChange}
	requireOneItemSelected={false}
>
	{#snippet children(item, isSelected, isDisabled)}
		<Tag variant="default" disabled={true} interactive={false}>
			{item}
		</Tag>
	{/snippet}
</ToggleGroup>
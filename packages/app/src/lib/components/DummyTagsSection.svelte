<script lang="ts">
	import { QuestionMark } from 'phosphor-svelte';
	import Heading from '$components/Heading.svelte';
	import Tooltip from '$components/Tooltip.svelte';
	import TagOperatorSwitch from '$components/TagOperatorSwitch.svelte';
	import ToggleGroup from '$components/ToggleGroup.svelte';
	import Tag from '$components/Tag.svelte';

	// Hardcoded dummy tags for preview purposes (in Dutch)
	const DUMMY_TAGS = [
		'Katten', 
		'Paarden', 
		'Wonen', 
		'Eten',
		'Verkeer'
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
		<Heading level={3} class="pr-2"> Onderwerpen </Heading>
		<Tooltip icon={QuestionMark} text="Thematische categorieën gebaseerd op krantenrubrieken, toegepast op alle data met behulp van machine learning. [Preview - Functie komt binnenkort beschikbaar]" placement="bottom" />
	</div>
	<div class="mt-2 mb-3">
		<TagOperatorSwitch 
			operator={currentTagOperator}
			onOperatorChange={handleTagOperatorChange}
			disabled={true}
			anyLabel="Minimaal één"
			allLabel="Alle"
			class="block"
		/>
		<span class="text-xs text-gray-400">
			Inclusief inhoud met geselecteerde onderwerpen (Preview modus - uitgeschakeld)
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

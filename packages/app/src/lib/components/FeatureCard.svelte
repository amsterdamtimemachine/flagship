<script lang="ts">
	import type { Feature, RawFeature, ImageFeature, TextFeature } from '@atm/shared/types';
	import { featureViewerState } from '$lib/state/featureState.svelte';
	import FeatureCardHeader from '$components/FeatureCardHeader.svelte';
	import FeatureCardFooter from '$components/FeatureCardFooter.svelte';
	import FeatureCardImage from '$components/FeatureCardImage.svelte';
	import FeatureCardText from '$components/FeatureCardText.svelte';
	import TagList from '$components/TagList.svelte';

	type Props = {
		feature: Feature;
		expanded?: boolean;
	};

	let { feature, expanded = false }: Props = $props();

	function handleExpand() {
		featureViewerState.openFeature(feature);
	}

	const commonProps: RawFeature = {
		ds: feature.ds,
		geom: feature.geom,
		per: feature.per,
		tit: feature.tit,
		url: feature.url,
		recordType: feature.recordType,
		tags: feature.tags
	};

	// Type-specific props extraction
	const getFeatureSpecificProps = () => {
		switch (feature.recordType) {
			case 'image':
				return { thumbnail: feature.thumbnail, alt: feature.alt};
			case 'text':
				return { text: feature.text}; // currently text has no non-generic properties
			case 'person':
				return { }; // currently person has no non-generic properties
			default:
				return {};
		}
	};

	const specificProps = getFeatureSpecificProps();
	
	// Debug logging
	console.log('FeatureCard feature object:', feature);
	console.log('FeatureCard specificProps:', specificProps);
	console.log('FeatureCard expanded:', expanded);
</script>

<div class="w-full border rounded-sm border-gray-300 bg-white min-w-0">
	<FeatureCardHeader class="p-2" feature={commonProps} />	
	<div class="{expanded ? '' : 'p-2'}">
		<h3 class="{expanded ? 'font-semibold text-xl text-black my-3 px-2' : 'font-semibold text-sm text-black line-clamp-2 mb-1'}">
			{commonProps.tit}
		</h3>
		<!-- Feature-specific content -->
		{#if feature.recordType === 'image'}
			<FeatureCardImage {...specificProps} expanded={expanded} onExpand={handleExpand} />
		{:else if feature.recordType === 'text'}
			<FeatureCardText {...specificProps} expanded={expanded} /> 
		{:else if feature.recordType === 'person'}
			<!-- Person feature has same properties as text so we're using the text card -->
			<FeatureCardText {...specificProps} expanded={expanded} />
		{:else}
			<div class="{expanded ? 'px-2' : ''} text-gray-500 text-sm">
				Unknown feature type: {feature.recordType}
			</div>
		{/if}
		
		<!-- Tags -->
		<TagList 
			tags={feature.tags || []} 
			expanded={expanded}
			maxVisible={expanded ? undefined : 2}
			class="{expanded ? 'py-2 px-2' : 'pt-2'}"
		/>
	</div>
	<FeatureCardFooter feature={feature} onExpand={handleExpand} expanded={expanded} />
</div>

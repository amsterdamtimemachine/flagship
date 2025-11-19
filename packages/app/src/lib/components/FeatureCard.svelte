<script lang="ts">
	import type { Feature, RawFeature, ImageFeature, TextFeature } from '@atm/shared/types';
	import { featureViewerState } from '$lib/state/featureState.svelte';
	import FeatureCardHeader from '$components/FeatureCardHeader.svelte';
	import FeatureCardFooter from '$components/FeatureCardFooter.svelte';
	import FeatureCardImage from '$components/FeatureCardImage.svelte';
	import FeatureCardText from '$components/FeatureCardText.svelte';
	import TagList from '$components/TagList.svelte';
	import Heading from '$components/Heading.svelte';

	type Props = {
		feature: Feature;
		expanded?: boolean;
	};

	let { feature, expanded = false }: Props = $props();

	// Feature flag to disable tags for launch
	const SHOW_TAGS = false;

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
</script>

<div class="w-full border rounded-sm border-atm-sand-border bg-atm-sand min-w-0">
	<FeatureCardHeader class="p-2" feature={commonProps} />
	<div class={expanded ? '' : 'p-2'}>
		<Heading
		level={3}
			class={expanded
				? 'font-medium text-xl my-3 px-2'
				: 'font-medium text-lg line-clamp-2 mb-1'}
		>
			{commonProps.tit}
		</Heading>
		<!-- Feature-specific content -->
		{#if feature.recordType === 'image' && 'thumbnail' in feature}
			<FeatureCardImage
				thumbnail={feature.thumbnail}
				alt={feature.alt}
				{expanded}
				onExpand={handleExpand}
			/>
		{:else if (feature.recordType === 'text' || feature.recordType === 'person') && 'text' in feature}
			<FeatureCardText text={feature.text} {expanded} />
		{:else}
			<div class="{expanded ? 'px-2' : ''} text-gray-800 text-sm">
				Unknown feature type: {feature.recordType}
			</div>
		{/if}

		<!-- Tags - Temporarily disabled for launch -->
		{#if SHOW_TAGS}
			<TagList
				tags={feature.tags || []}
				{expanded}
				maxVisible={expanded ? undefined : 2}
				class={expanded ? 'py-2 px-2' : 'pt-2'}
			/>
		{/if}
	</div>
	<FeatureCardFooter {feature} onExpand={handleExpand} {expanded} />
</div>

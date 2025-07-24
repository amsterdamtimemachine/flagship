<script lang="ts">
	import type { Feature, RawFeature, ImageFeature, TextFeature } from '@atm/shared/types';
	import FeatureHeader from '$components/FeatureHeader.svelte';
	import FeatureImage from '$components/FeatureImage.svelte';
	import FeatureText from '$components/FeatureText.svelte';

	type Props = {
		feature: Feature;
	};

	let { feature }: Props = $props();

	// Extract common RawFeature properties
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
				return { thumb: (feature as ImageFeature).thumb };
			case 'text':
				return { text: (feature as TextFeature).text };
			default:
				return {};
		}
	};

	const specificProps = getFeatureSpecificProps();
</script>

<div class="w-full border-2 border-solid border-gray-200 p-2 bg-white">
	<!-- Common header for all feature types -->
	<FeatureHeader feature={commonProps} />
	
	<!-- Feature-specific content -->
	{#if feature.recordType === 'image'}
		<FeatureImage {...specificProps} />
	{:else if feature.recordType === 'text'}
		<FeatureText {...specificProps} />
	{:else}
		<div class="p-2 text-gray-500 text-sm">
			Unknown feature type: {feature.recordType}
		</div>
	{/if}
</div>

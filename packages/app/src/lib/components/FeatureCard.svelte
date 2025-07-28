<script lang="ts">
	import type { Feature, RawFeature, ImageFeature, TextFeature } from '@atm/shared/types';
	import FeatureHeader from '$components/FeatureHeader.svelte';
	import FeatureCardImage from '$components/FeatureCardImage.svelte';
	import FeatureCardText from '$components/FeatureCardText.svelte';

	type Props = {
		feature: Feature;
	};

	let { feature }: Props = $props();

	// Extract generic RawFeature properties
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
				return { thumbnail: feature.thumbnail };
			case 'text':
				return { }; // currently text has no non-generic properties
			case 'person':
				return { }; // currently person has no non-generic properties
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
		<FeatureCardImage {...specificProps} />
	{:else if feature.recordType === 'text'}
		<!-- <FeatureCardText {...specificProps} /> -->
	{:else if feature.recordType === 'person'}
		<!-- Person feature has same properties as text so we're using the text card -->
		<!-- <FeatureCardText {...specificProps} /> -->
	{:else}
		<div class="p-2 text-gray-500 text-sm">
			Unknown feature type: {feature.recordType}
		</div>
	{/if}
</div>

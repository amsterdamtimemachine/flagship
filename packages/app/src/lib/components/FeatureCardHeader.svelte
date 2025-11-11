<script lang="ts">
	import type { RawFeature } from '@atm/shared/types';
	import { mergeCss } from '$utils/utils';
	import { formatTimePeriod } from '$utils/format';
	import { translateContentType } from '$utils/translations';
	import Tag from './Tag.svelte';

	type Props = {
		feature: RawFeature;
		class?: string;
	};

	let { feature, class: className }: Props = $props();
</script>

<div class={mergeCss('border-b border-atm-sand-border', className)}>
	<!-- Dataset and Record Type -->
	<div class="flex w-full justify-between items-center">
		<Tag variant="outline">
			{translateContentType(feature.recordType)}
		</Tag>
		<span class="text-sm text-black">
			{formatTimePeriod(feature.per)}
		</span>
	</div>
</div>

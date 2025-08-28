<script lang="ts">
	import type { RawFeature } from '@atm/shared/types';
	import { mergeCss } from '$utils/utils';
	import { formatTimePeriod} from '$utils/format';

	type Props = {
		feature: RawFeature;
		className?: string;
	};

	let { feature, class: className }: Props = $props();
</script>

<div class={mergeCss("border-b border-gray-300", className)}>
	<!-- Dataset and Record Type -->
	<div class="flex w-full justify-between items-center">
		<span class="text-xs text-black">
			{feature.recordType}
		</span>
		<span class="text-xs text-black">
			{formatTimePeriod(feature.per)}
		</span>	
	</div>
</div>

<script lang="ts">
	import MainPageComponent from '$routes/(map)/+page.svelte';
	import ErrorHandler from '$components/ErrorHandler.svelte';
	import GridCellData from '$components/GridCellData.svelte';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
	
	let showCellModal = false; //$derived(!!data.cellData);
	
	function closeCellModal() {
		goto(`/${data.initialPeriod}${window.location.search}`);
	}
</script>

<ErrorHandler errorData={data.errorData} />
<MainPageComponent {data} />

<!-- Add cell modal overlay -->
{#if showCellModal && data.cellData}
	<div class="z-40 absolute p-4 top-0 right-0 w-1/2 h-full bg-white overflow-y-auto border-l border-solid border-gray-300">
		<GridCellData data={data.cellData} onClose={closeCellModal} />
	</div>
{/if}

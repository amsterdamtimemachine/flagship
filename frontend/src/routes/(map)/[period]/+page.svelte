<script lang="ts">
	import MainPageComponent from '$routes/(map)/+page.svelte';
	import ErrorHandler from '$components/ErrorHandler.svelte';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
</script>

<ErrorHandler errorData={data.errorData} />
<MainPageComponent {data} />

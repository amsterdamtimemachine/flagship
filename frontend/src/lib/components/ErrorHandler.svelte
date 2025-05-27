<script lang="ts" module>
	import { addToast } from '$components/Toaster.svelte';
	import type { AppError, PageErrorData } from '$types/error';
	
	export function handlePageErrors(errorData: PageErrorData) {
		if (!errorData.hasErrors) return;
		
		errorData.errors.forEach(error => {
			addToast({
				data: {
					title: error.title,
					description: error.description,
					type: error.type
				}
			});
		});
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageErrorData } from '$lib/types/errors';
	
	interface Props {
		errorData: PageErrorData;
	}
	
	let { errorData }: Props = $props();
	
	onMount(() => {
		handlePageErrors(errorData);
	});
</script>


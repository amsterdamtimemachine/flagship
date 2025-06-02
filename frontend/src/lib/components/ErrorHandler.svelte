<script lang="ts">
	import { onMount } from 'svelte';
	import type { PageErrorData } from '$lib/types/errors';	
	import { addToast } from '$components/Toaster.svelte';

	interface Props {
		errorData: PageErrorData;
	}
	
	let { errorData }: Props = $props();
	let processedErrorIds = $state(new Set<string>());
	
	onMount(() => {
		handlePageErrors(errorData);
		// Track processed error IDs to avoid duplicates
		errorData.errors.forEach(error => {
			processedErrorIds.add(error.id);
		});
	});
	
	// Reactively process new errors when errorData changes
	$effect(() => {
		if (!errorData.hasErrors) return;
		
		// Only process new errors that haven't been shown yet
		const newErrors = errorData.errors.filter(error => !processedErrorIds.has(error.id));
		
		if (newErrors.length > 0) {
			newErrors.forEach(error => {
				addToast({
					data: {
						title: error.title,
						description: error.description,
						type: error.type
					}
				});
				// Track this error as processed
				processedErrorIds.add(error.id);
			});
		}
	});

	function handlePageErrors(errorData: PageErrorData) {
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

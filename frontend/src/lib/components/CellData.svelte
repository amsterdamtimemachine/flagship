<!-- CellData.svelte -->
<script lang="ts">
    import FeatureBlock from '$components/FeatureBlock.svelte';
    import type { CellFeaturesResponse } from '@atm/shared-types';
    import { fetchApi } from '$api';
    import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';
    import { onMount } from 'svelte';

    export let cellId: string;
    export let period: string;
    export let initialFeatures: any[] | undefined = undefined;  // Optional initial data

    let allFeatures = initialFeatures || [];
    let currentPage = 1;
    let loading = false;
    let initialLoading = !initialFeatures;  // Only show loading if no initial data
    let hasMorePages = false;
    let totalPages = 1;

    $: baseUrl = import.meta.env.MODE === 'production' ? 
        PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;

    async function loadInitialData() {
        if (initialFeatures) return; 
        
        try {
            const url = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=1`;
            const response = await fetchApi<CellFeaturesResponse>(url);
            console.log(response);
            
            allFeatures = response.features;
            currentPage = response.currentPage;
            totalPages = response.totalPages;
            hasMorePages = currentPage < totalPages;
        } catch (error) {
            console.error('Error loading initial data:', error);
        } finally {
            initialLoading = false;
        }
    }

    async function loadMore() {
        if (loading || !hasMorePages) return;
        
        loading = true;
        try {
            const url = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=${currentPage + 1}`;
            const response = await fetchApi<CellFeaturesResponse>(url);
            
            allFeatures = [...allFeatures, ...response.features];
            currentPage = response.currentPage;
            totalPages = response.totalPages;
            hasMorePages = currentPage < totalPages;
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        loadInitialData();
    });
</script>

{#if initialLoading}
    <div>Loading cell data...</div>
{:else}
    <div class="p-4">
        <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-bold">Cell Data</h2>
            <button 
                class="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300"
                on:click={() => history.back()}
            >
                Close
            </button>
        </div>

        <div class="mb-4">
            <div>Cell ID: {cellId}</div>
            <div>Period: {period}</div>
            <div>Total features loaded: {allFeatures.length}</div>
        </div>

        <div class="space-y-4">
            {#each allFeatures as feature}
                <FeatureBlock {feature}/>
            {/each}
        </div>

        {#if hasMorePages}
            <div class="mt-4 text-center">
                <button 
                    class="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-blue-300"
                    on:click={loadMore} 
                    disabled={loading}
                >
                    {loading ? 'Loading...' : 'Load More'}
                </button>
            </div>
        {/if}
    </div>
{/if}

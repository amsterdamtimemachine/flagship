<script lang="ts">
import FeatureBlock from '$components/FeatureBlock.svelte';
import type { CellFeaturesResponse } from '@atm/shared-types';
import type { PageData } from './$types';
import { fetchApi } from '$api';
import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';

export let data: PageData;  

let allFeatures = data.cellFeatures.features;  // Start with initial features
let currentPage = data.cellFeatures.currentPage;  // Should be 1 from server
let loading = false;
let hasMorePages = currentPage < data.cellFeatures.totalPages;

$: baseUrl = import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;

async function loadMore() {
    if (loading || !hasMorePages) return;
    loading = true;
    
    try {
        const url = `${baseUrl}/grid/cell/${data.cellFeatures.cellId}?period=${data.cellFeatures.period}&page=${currentPage + 1}`;
        const response = await fetchApi<CellFeaturesResponse>(url); 
        allFeatures = allFeatures.concat(response.features);
        currentPage = response.currentPage;
        hasMorePages = currentPage < response.totalPages;
    } catch (error) {
        console.error('Error loading more features:', error);
    } finally {
        loading = false;
    }
}
</script>

{#if data.cellFeatures}
  <div>{data.cellFeatures.cellId}</div>
  <div>{data.cellFeatures.period}</div>
  <div>Total features loaded: {allFeatures.length}</div>
  
  {#if hasMorePages}
    <button 
      on:click={loadMore} 
      disabled={loading}
    >
      {loading ? 'Loading...' : 'Load More'}
    </button>
  {/if}

  {#each data.cellFeatures.features as feature}
    <FeatureBlock {feature}/>

  {/each}
{/if}

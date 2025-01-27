<script lang="ts">
import type { CellFeaturesResponse } from '@atm/shared-types';
export let data : CellFeaturesResponse;


$: cellFeatures = data?.cellFeatures; 
$: console.log(cellFeatures);


</script>

{#if cellFeatures}

  <div>{cellFeatures.cellId} </div>

{/if}


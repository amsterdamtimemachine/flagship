<script lang="ts">
  import type { GeoFeatures } from '@atm/shared-types';
  export let features: GeoFeatures[];
  import Masonry from 'svelte-masonry';
  import BlockImage from '$components/BlockImage.svelte';
  import BlockEvent from '$components/BlockEvent.svelte';
  

 // function getFeatureId(feature: GeoFeatures) {
 //   return `${feature.content_class}-${feature.properties.title}`; 
 // }

</script>

<div class="idea-board-container"> 
  <Masonry options={{ 
    itemSelector: '.masonry-item',
    columnWidth: 250,
    gutter: 20
  }}>
{#each features as feature, index (index)}
    <div class="item item-{index}">
        {#if feature.content_class === 'Event'}
            <BlockEvent feature={feature} />
        {:else if feature.content_class === 'Image'}
            <BlockImage feature={feature} />
        {/if}
    </div>
{/each}
  </Masonry>
</div>

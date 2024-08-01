<script lang="ts">
 import {onMount} from 'svelte';
 import {transformToGeoImages} from '$utils/image';
 import Worker from '$lib/workers/worker.ts?worker';
 import type {ImageResponse, ImageData, GeoImage} from '$types/image';

 export let data: { images: ImageData };
 let geoImages: GeoImage[];

  onMount(() => {
    geoImages = transformToGeoImages(data.images);
  });
</script>

<div>
  hello world
</div>

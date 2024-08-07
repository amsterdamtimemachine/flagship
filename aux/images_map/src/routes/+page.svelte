<script lang="ts">
 import { onMount } from 'svelte';
 import Map from '$components/Map.svelte';
 import MapMapbox from '$components/MapMapbox.svelte';
 import { transformToGeoImages } from '$utils/image';
 import type { ImageResponse, Photograph, GeoImage } from '$types/image';
 import type { Point } from '$types/geometry';
 
 export let data: { images: ImageResponse };
 let geoImages: GeoImage[] = [];
 let points: Point[] = [];

 onMount(() => {
   let photographs = data.images['@graph'];
   geoImages = transformToGeoImages(photographs);
   points = geoImages
     .map((image) => image.location)
     .filter((location): location is Point => location !== null);
 });
</script>
<div>
  <Map {points}/>
</div>


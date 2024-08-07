<script lang="ts">
 import { onMount } from 'svelte';
 import Map from '$components/Map.svelte';
 import MapMapbox from '$components/MapMapbox.svelte';
 import { transformToGeoImages } from '$utils/image';
 import { generateDensityMapData } from '$utils/geo';
 import type { ImageResponse, Photograph, GeoImage } from '$types/image';
 import type { Point } from '$types/geo';
 
 export let data: { images: ImageResponse };
 let geoImages: GeoImage[] = [];
 let points: Point[] = [];
 let density: any = {};
 const latLongMin =  {x: 4.86763, y: 52.3892206};
 const latLongMax =  {x:4.92136, y: 52.3413175};
 
 onMount(() => {
   let photographs = data.images['@graph'];
   geoImages = transformToGeoImages(photographs);
   points = geoImages
     .map((image) => image.location)
     .filter((location): location is Point => location !== null);

    density = generateDensityMapData(points, latLongMin, latLongMax, 50)

 });
</script>
<div>
  <Map {points} {density}/>
</div>


<script lang="ts">
 import {onMount} from 'svelte';
 import Map from '$components/Map.svelte';
 import MapMapbox from '$components/MapMapbox.svelte';
 import {transformToGeoImages} from '$utils/image';
 import type {ImageResponse, ImageData, GeoImage} from '$types/image';
 import type {Point} from '$types/geometry';

 export let data: { images: ImageData };
 let geoImages: GeoImage[];
 let points : Point[] = [];

//function countUniquePoints(points: Point[]): number {
//  const uniquePoints = new Set<string>();
//
//  for (const point of points) {
//    // Convert each point to a string representation
//    const pointString = `${point.x},${point.y}`;
//    uniquePoints.add(pointString);
//  }
//
//  return uniquePoints.size;
//}

  onMount(() => {
    geoImages = transformToGeoImages(data.images);
    points = geoImages
      .map((image) => image.location)
      .filter((location): location is Point => location !== null);
    //console.log(countUniquePoints(points));
  });
</script>

<div>

  <Map points={points}/>  
  <MapMapbox points={points}/>  
</div>


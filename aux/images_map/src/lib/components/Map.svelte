<script lang="ts">
  import { onMount } from 'svelte';
  import type { Point } from '$types/geometry';
  import maplibre, { Map, type LngLatLike } from 'maplibre-gl';

  export let points: Point[] = []; 
  export let center: LngLatLike = [4.9, 52.37]; 
  export let zoom: number = 12; 

  let map: Map | undefined;
  let mapContainer: HTMLElement;

  onMount(() => {
    if (!mapContainer) return;

    map = new maplibre.Map({
      container: mapContainer,
      style: 'https://demotiles.maplibre.org/style.json', // Free demo style
      center: center,
      zoom: zoom
    });

    map.on('load', () => {
      if (!map) return;

      // Add a new source and layer for our points
      map.addSource('points', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: points.map(({x, y}) => ({
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [x, y]
            },
            properties: {}
          }))
        }
      });

      map.addLayer({
        id: 'points',
        type: 'circle',
        source: 'points',
        paint: {
          'circle-radius': 6,
          'circle-color': '#B42222'
        }
      });
    });

    return () => {
      if (map) {
        map.remove();
      }
    };
  });
</script>

<div bind:this={mapContainer} class="map-container"></div>

<style>
  .map-container {
    width: 100%;
    height: 400px;
  }

  :global(.maplibregl-canvas) {
    width: 100% !important;
    height: 100% !important;
  }
</style>

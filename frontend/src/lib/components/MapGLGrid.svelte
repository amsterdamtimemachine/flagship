<!-- MapGLGrid.svelte -->
<script lang="ts">
   import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
   import { onMount, onDestroy, createEventDispatcher } from 'svelte';
   import maplibre, { type Map } from 'maplibre-gl';
   import type { Heatmap, HeatmapCell, GridDimensions } from '@atm/shared-types';
   import 'maplibre-gl/dist/maplibre-gl.css';

   export let heatmap: Heatmap;
   export let dimensions: GridDimensions;
   
   const MIN_ZOOM = 1; 
   const MAX_ZOOM = 16;
   const DEFAULT_ZOOM = 13;
   const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

   let map: Map | undefined;
   let mapContainer: HTMLElement;
   let isMapLoaded = false;

   // Add reactive statement to update map when heatmap changes
   $: if (isMapLoaded && map && heatmap) {
       const source = map.getSource('grid') as maplibre.GeoJSONSource;
       if (source) {
           source.setData(generateGridFeatures(heatmap));
       }
   }

   function generateGridFeatures(heatmap: Heatmap) {
       const maxCount = Math.max(...heatmap.cells.map(cell => cell.featureCount));
       
       const features = heatmap.cells.map(cell => ({
           type: 'Feature',
           properties: {
               id: cell.cellId,
               value: Math.max(cell.featureCount / maxCount, 0.1),
               count: cell.featureCount
           },
           geometry: {
               type: 'Polygon',
               coordinates: [[
                   [cell.bounds.minLon, cell.bounds.minLat],
                   [cell.bounds.maxLon, cell.bounds.minLat],
                   [cell.bounds.maxLon, cell.bounds.maxLat],
                   [cell.bounds.minLon, cell.bounds.maxLat],
                   [cell.bounds.minLon, cell.bounds.minLat]
               ]]
           }
       }));

       return {
           type: 'FeatureCollection',
           features
       };
   }

   const dispatch = createEventDispatcher<{
       cellHover: {
           id: string;
           coordinates: number[][];
           mouseX: number;
           mouseY: number;
           value: number;
           count: number;
       };
       cellLeave: void;
       cellClick: {
           id: string;
           coordinates: number[][];
           value: number;
           count: number;
       };
   }>();

   onMount(() => {
       if (!mapContainer) return;
       
       const { minLon: west, maxLon: east, minLat: south, maxLat: north } = dimensions;
       
       map = new maplibre.Map({
           container: mapContainer,
           style: STYLE_URL,
           bounds: [[west, south], [east, north]],
           minZoom: MIN_ZOOM,
           maxZoom: MAX_ZOOM,
           zoom: DEFAULT_ZOOM,
           dragRotate: false,
           touchZoomRotate: false,
           dragPan: true,
           keyboard: true,
           scrollZoom: true
       });

       map.on('load', () => {
           map.addSource('grid', {
               type: 'geojson',
               data: generateGridFeatures(heatmap),
               promoteId: 'id'
           });

           map.addLayer({
               id: 'heatmap-squares',
               type: 'fill',
               source: 'grid',
               paint: {
                   'fill-color': '#0000ff',
                   'fill-opacity': ['get', 'value']
               }
           });

           // Event handlers
           map.on('mousemove', 'heatmap-squares', (e) => {
               if (e.features?.[0]) {
                   const feature = e.features[0];
                   dispatch('cellHover', {
                       id: feature.properties.id,
                       coordinates: feature.geometry.coordinates,
                       mouseX: e.point.x,
                       mouseY: e.point.y,
                       value: feature.properties.value,
                       count: feature.properties.count
                   });
               }
           });

           map.on('mouseleave', 'heatmap-squares', () => {
               dispatch('cellLeave');
           });

           map.on('click', 'heatmap-squares', (e) => {
               if (e.features?.[0]) {
                   const feature = e.features[0];
                   dispatch('cellClick', {
                       id: feature.properties.id,
                       coordinates: feature.geometry.coordinates,
                       value: feature.properties.value,
                       count: feature.properties.count
                   });
               }
           });

           map.on('mouseenter', 'heatmap-squares', () => {
               map.getCanvas().style.cursor = 'pointer';
           });
           
           map.on('mouseleave', 'heatmap-squares', () => {
               map.getCanvas().style.cursor = '';
           });

           isMapLoaded = true;
       });
   });

   onDestroy(() => {
       if (map) {
           map.remove();
       }
   });
</script>

<div bind:this={mapContainer} class="map-container" />

<style>
   .map-container {
       width: 100%;
       height: 100vh;
       position: relative;
   }
   :global(.maplibregl-canvas) {
       width: 100% !important;
       height: 100% !important;
   }
</style>

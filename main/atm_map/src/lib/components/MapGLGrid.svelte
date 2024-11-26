<script lang="ts">
    import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import maplibre, { type Map } from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    interface Cell {
        cellId: string;
        count: number;
        bounds: {
            minLon: number;
            maxLon: number;
            minLat: number;
            maxLat: number;
        };
    }

    interface MapBounds {
        boundA: [number, number];
        boundB: [number, number];
    }

    interface Dimensions {
        width: number;
        height: number;
    }

    export let cells: Cell[] = [];
    export let bounds: MapBounds;
    export let dimensions: Dimensions;

    const MIN_ZOOM = 1;
    const MAX_ZOOM = 50;
    const DEFAULT_ZOOM = 13;
    const PADDING = 3.0;

    const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

    let map: Map | undefined;
    let mapContainer: HTMLElement;

    function generateGridFeatures(cells: Cell[]) {
        // Find the maximum count to normalize values
        const maxCount = Math.max(...cells.map(cell => cell.count));

        const features = cells.map(cell => ({
            type: 'Feature',
            properties: {
                id: cell.cellId,
                value: cell.count / maxCount, // Normalize the count
                isData: true,
                count: cell.count
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
            features: features
        };
    }

    const dispatch = createEventDispatcher();

    onMount(() => {
        if (!mapContainer) return;
        
        const [west, north] = bounds.boundA;
        const [east, south] = bounds.boundB;
        
        console.log('Initializing map with bounds:', { west, north, east, south });
        console.log('Number of cells:', cells.length);
        
        map = new maplibre.Map({
            container: mapContainer,
            style: STYLE_URL,
            bounds: [[west, south], [east, north]],
            maxBounds: [
                [west - PADDING, south - PADDING],
                [east + PADDING, north + PADDING]
            ],
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
            console.log('Map loaded, adding features');
            
            const geojson = generateGridFeatures(cells);
            console.log('Generated features:', geojson.features.length);

            map.addSource('grid', {
                type: 'geojson',
                data: geojson
            });

            // Add data squares layer with heat gradient
            map.addLayer({
                id: 'data-squares',
                type: 'fill',
                source: 'grid',
                paint: {
                    'fill-color': [
                        'interpolate',
                        ['linear'],
                        ['get', 'value'],
                        0, '#deebf7',
                        0.5, '#3182bd',
                        1, '#08519c'
                    ],
                    'fill-opacity': 0.8
                }
            });

            map.on('mousemove', 'data-squares', (e) => {
                if (e.features && e.features.length > 0) {
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

            map.on('mouseleave', 'data-squares', () => {
                dispatch('cellLeave');
            });

            map.on('click', 'data-squares', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    dispatch('cellClick', {
                        id: feature.properties.id,
                        coordinates: feature.geometry.coordinates,
                        value: feature.properties.value,
                        count: feature.properties.count
                    });
                }
            });

            map.on('mouseenter', 'data-squares', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'data-squares', () => {
                map.getCanvas().style.cursor = '';
            });
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

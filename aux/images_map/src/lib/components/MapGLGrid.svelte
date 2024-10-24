<script lang="ts">
    import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
    import { onMount, onDestroy, createEventDispatcher } from 'svelte';
    import maplibre, { type Map, type LngLatLike } from 'maplibre-gl';
    import 'maplibre-gl/dist/maplibre-gl.css';

    const dispatch = createEventDispatcher<{
        cellHover: {
            id: string;
            coordinates: number[][];
            mouseX: number;
            mouseY: number;
        };
        cellLeave: void;
        cellClick: {
            id: string;
            coordinates: number[][];
        };
    }>();

    const AMSTERDAM_BOUNDS = {
        west: 4.8353577,
        east: 4.9277115,
        south: 52.3349108,
        north: 52.4046176
    };

    const PADDING = 0.02;
    const MAX_BOUNDS = [
        [AMSTERDAM_BOUNDS.west - PADDING, AMSTERDAM_BOUNDS.south - PADDING],
        [AMSTERDAM_BOUNDS.east + PADDING, AMSTERDAM_BOUNDS.north + PADDING]
    ];

    const MIN_ZOOM = 11;
    const MAX_ZOOM = 16;
    const DEFAULT_ZOOM = 13;
    const CELL_SIZE = 0.001;

    let map: Map | undefined;
    let mapContainer: HTMLElement;
    let hoveredStateId: string | null = null;

    const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

    function generateGridFeatures() {
        const features = [];
        
        for (let lng = AMSTERDAM_BOUNDS.west; lng <= AMSTERDAM_BOUNDS.east; lng += CELL_SIZE) {
            for (let lat = AMSTERDAM_BOUNDS.south; lat <= AMSTERDAM_BOUNDS.north; lat += CELL_SIZE) {
                features.push({
                    type: 'Feature',
                    properties: {
                        id: `cell-${lng}-${lat}`
                    },
                    geometry: {
                        type: 'Polygon',
                        coordinates: [[
                            [lng, lat],
                            [lng + CELL_SIZE, lat],
                            [lng + CELL_SIZE, lat + CELL_SIZE],
                            [lng, lat + CELL_SIZE],
                            [lng, lat]
                        ]]
                    }
                });
            }
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    }

    onMount(() => {
        if (!mapContainer) return;
        
        map = new maplibre.Map({
            container: mapContainer,
            style: STYLE_URL,
            bounds: [
                [AMSTERDAM_BOUNDS.west, AMSTERDAM_BOUNDS.south],
                [AMSTERDAM_BOUNDS.east, AMSTERDAM_BOUNDS.north]
            ],
            maxBounds: MAX_BOUNDS,
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
                data: generateGridFeatures(),
                promoteId: 'id'
            });

            map.addLayer({
                id: 'grid-cells',
                type: 'fill',
                source: 'grid',
                paint: {
                    'fill-color': '#0000ff',
                    'fill-opacity': [
                        'case',
                        ['boolean', ['feature-state', 'hover'], false],
                        0.3,
                        0.1
                    ]
                }
            });

            map.addLayer({
                id: 'grid-lines',
                type: 'line',
                source: 'grid',
                paint: {
                    'line-color': '#4444ff',
                    'line-width': 1,
                    'line-opacity': 0.5
                }
            });

            map.on('mousemove', 'grid-cells', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];

                    if (hoveredStateId) {
                        map.setFeatureState(
                            { source: 'grid', id: hoveredStateId },
                            { hover: false }
                        );
                    }

                    hoveredStateId = feature.properties.id;

                    map.setFeatureState(
                        { source: 'grid', id: hoveredStateId },
                        { hover: true }
                    );

                    dispatch('cellHover', {
                        id: feature.properties.id,
                        coordinates: feature.geometry.coordinates,
                        mouseX: e.point.x,
                        mouseY: e.point.y
                    });
                }
            });

            map.on('mouseleave', 'grid-cells', () => {
                if (hoveredStateId) {
                    map.setFeatureState(
                        { source: 'grid', id: hoveredStateId },
                        { hover: false }
                    );
                    hoveredStateId = null;
                    dispatch('cellLeave');
                }
            });

            map.on('click', 'grid-cells', (e) => {
                if (e.features && e.features.length > 0) {
                    const feature = e.features[0];
                    dispatch('cellClick', {
                        id: feature.properties.id,
                        coordinates: feature.geometry.coordinates
                    });
                }
            });

            map.on('mouseenter', 'grid-cells', () => {
                map.getCanvas().style.cursor = 'pointer';
            });

            map.on('mouseleave', 'grid-cells', () => {
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

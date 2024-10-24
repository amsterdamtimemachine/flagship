<!-- MapWithGrid.svelte -->
<script lang="ts">
    import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
    import { onMount, onDestroy } from 'svelte';
    import maplibre, { type Map, type LngLatLike, type LngLatBounds } from 'maplibre-gl';

    // Amsterdam bounds
    const AMSTERDAM_BOUNDS = {
        west: 4.8353577,
        east: 4.9277115,
        south: 52.3349108,
        north: 52.4046176
    };

    const FIXED_ZOOM = 12;
    const CELL_SIZE = 0.01;

    interface GridCell {
        id: string;
        coordinates: [number, number];
    }

    let map: Map | undefined;
    let mapContainer: HTMLElement;
    let viewportCells: GridCell[] = [];

    const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

    function calculateGridCells() {
        const newCells: GridCell[] = [];
        
        for (let lng = AMSTERDAM_BOUNDS.west; lng <= AMSTERDAM_BOUNDS.east; lng += CELL_SIZE) {
            for (let lat = AMSTERDAM_BOUNDS.south; lat <= AMSTERDAM_BOUNDS.north; lat += CELL_SIZE) {
                newCells.push({
                    id: `cell-${lng}-${lat}`,
                    coordinates: [lng, lat],
                });
            }
        }

        console.log(`Created ${newCells.length} cells`);
        return newCells;
    }

    function projectToPixel(lngLat: [number, number]): [number, number] {
        if (!map) return [0, 0];
        const point = map.project(lngLat);
        return [point.x, point.y];
    }

    function getGridCellStyle(coordinates: [number, number]) {
        if (!map) return '';
        
        const [x1, y1] = projectToPixel(coordinates);
        const [x2, y2] = projectToPixel([
            coordinates[0] + CELL_SIZE,
            coordinates[1] + CELL_SIZE
        ]);

        return `
            position: absolute;
            left: ${x1}px;
            top: ${y1}px;
            width: ${Math.abs(x2 - x1)}px;
            height: ${Math.abs(y2 - y1)}px;
            background: rgba(0, 0, 255, 0.1);
        `;
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
            zoom: FIXED_ZOOM,
            maxZoom: FIXED_ZOOM,
            minZoom: FIXED_ZOOM,
            dragRotate: false,
            touchZoomRotate: false,
            dragPan: true,
            keyboard: false,
            scrollZoom: false
        });

        map.on('load', () => {
            viewportCells = calculateGridCells();
            
            map.on('move', () => {
                viewportCells = [...viewportCells];
            });
        });

        // Click handler for debugging
        map.on('click', (e) => {
            console.group('Click Debug Info');
            console.log('Click coordinates:', [e.lngLat.lng, e.lngLat.lat]);
            console.log('Is within Amsterdam bounds:', 
                e.lngLat.lng >= AMSTERDAM_BOUNDS.west &&
                e.lngLat.lng <= AMSTERDAM_BOUNDS.east &&
                e.lngLat.lat >= AMSTERDAM_BOUNDS.south &&
                e.lngLat.lat <= AMSTERDAM_BOUNDS.north
            );
            console.groupEnd();
        });
    });

    onDestroy(() => {
        if (map) {
            map.remove();
        }
    });
</script>

<div bind:this={mapContainer} class="map-container">
    <!-- Grid Layer with pointer-events-none -->
    <div class="absolute inset-0 pointer-events-none">
        {#each viewportCells as cell}
            <button
                class="absolute border border-blue-500 hover:bg-blue-100 transition-colors pointer-events-auto"
                style={getGridCellStyle(cell.coordinates)}
            />
        {/each}
    </div>
</div>

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

    /* Required MapLibre styles */
</style>

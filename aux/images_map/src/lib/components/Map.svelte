<!-- MapWithGrid.svelte -->
<script lang="ts">
    import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
    import { onMount, onDestroy } from 'svelte';
    import type { Point } from '$types/geo';
    import maplibre, { type Map, type LngLatLike, type LngLatBounds } from 'maplibre-gl';

    // Props from your existing component
    export let points: Point[] = [];
    export let density: any = {};
    export let center: LngLatLike = [4.9, 52.37];
    export let zoom: number = 6;

    interface GridCell {
        id: string;
        coordinates: [number, number];
        value: number;
        dataPoints: number;
    }

    let map: Map | undefined;
    let mapContainer: HTMLElement;
    let gridOverlay: HTMLElement;
    let viewportCells: GridCell[] = [];
    let focusedCell: string | null = null;

    const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;
    const BASE_CELL_PIXEL_SIZE = 50;
    const GRID_CELL_SIZE_METERS = 100;

    function calculateGridCells(bounds: LngLatBounds, currentZoom: number) {
        const metersPerPixel = 156543.03392 * Math.cos(bounds.getCenter().lat * Math.PI / 180) 
            / Math.pow(2, currentZoom);
        const cellSizeDegrees = (GRID_CELL_SIZE_METERS * metersPerPixel) / 111320;

        const west = Math.floor(bounds.getWest() / cellSizeDegrees) * cellSizeDegrees;
        const east = Math.ceil(bounds.getEast() / cellSizeDegrees) * cellSizeDegrees;
        const south = Math.floor(bounds.getSouth() / cellSizeDegrees) * cellSizeDegrees;
        const north = Math.ceil(bounds.getNorth() / cellSizeDegrees) * cellSizeDegrees;

        const newCells: GridCell[] = [];
        
        for (let lng = west; lng < east; lng += cellSizeDegrees) {
            for (let lat = south; lat < north; lat += cellSizeDegrees) {
                newCells.push({
                    id: `cell-${lng}-${lat}`,
                    coordinates: [lng, lat],
                    value: Math.random(),
                    dataPoints: Math.floor(Math.random() * 100)
                });
            }
        }

        return newCells;
    }

    function updateGrid() {
        if (!map) return;
        const bounds = map.getBounds();
        const currentZoom = map.getZoom();
        viewportCells = calculateGridCells(bounds, currentZoom);
    }

    function projectToPixel(lngLat: [number, number]): [number, number] {
        if (!map) return [0, 0];
        const point = map.project(lngLat);
        return [point.x, point.y];
    }

    function handleCellFocus(cellId: string) {
        focusedCell = cellId;
    }

    function getGridCellStyle(coordinates: [number, number]) {
        const [x, y] = projectToPixel(coordinates);
        const currentZoom = map?.getZoom() ?? zoom;
        const size = BASE_CELL_PIXEL_SIZE * Math.pow(2, currentZoom - 15);
        
        return `
            position: absolute;
            left: ${x}px;
            top: ${y}px;
            width: ${size}px;
            height: ${size}px;
        `;
    }

    onMount(() => {
        if (!mapContainer) return;
        
        map = new maplibre.Map({
            container: mapContainer,
            style: STYLE_URL,
            center: center,
            zoom: zoom
        });

        map.on('load', () => {
            if (!map) return;
            
            // Add your existing layers
            map.addSource('points', {
                type: 'geojson',
                data: {
                    type: 'FeatureCollection',
                    features: points.map(({ x, y }) => ({
                        type: 'Feature',
                        geometry: {
                            type: 'Point',
                            coordinates: [x, y]
                        },
                        properties: {}
                    }))
                }
            });

            map.addSource('density', {
                type: 'geojson',
                data: density
            });

            map.addLayer({
                id: 'points',
                type: 'circle',
                source: 'points',
                paint: {
                    'circle-radius': 2,
                    'circle-color': '#000000'
                }
            });

            map.addLayer({
                id: 'density-layer',
                type: 'fill',
                source: 'density',
                paint: {
                    'fill-color': '#007cbf',
                    'fill-opacity': ['get', 'opacity']
                }
            });

            updateGrid();
        });

        map.on('moveend', updateGrid);
        map.on('zoomend', updateGrid);
    });

    onDestroy(() => {
        if (map) {
            map.remove();
        }
    });

    $: focusedCellData = focusedCell 
        ? viewportCells.find(c => c.id === focusedCell)
        : null;
</script>

<div bind:this={mapContainer} class="map-container">
    <!-- SVG Overlay -->
    <svg class="absolute inset-0 w-full h-full pointer-events-none">
        {#each viewportCells as cell}
            {@const [x, y] = projectToPixel(cell.coordinates)}
            {@const currentZoom = map?.getZoom() ?? zoom}
            {@const size = BASE_CELL_PIXEL_SIZE * Math.pow(2, currentZoom - 15)}
            <rect
                x={x}
                y={y}
                width={size}
                height={size}
                fill="rgb(0, 0, {Math.floor(cell.value * 255)})"
                opacity={focusedCell === cell.id ? 0.8 : 0.6}
            />
        {/each}
    </svg>

    <!-- Accessible Interactive Layer -->
    <div 
        class="absolute inset-0"
        role="grid"
        aria-label="Historical data heatmap"
        bind:this={gridOverlay}
    >
        {#each viewportCells as cell}
            <button
                class="absolute focus:outline-none focus:ring-1 focus:ring-blue-500 focus:ring-inset focus:z-10"
                style={getGridCellStyle(cell.coordinates)}
                on:focus={() => handleCellFocus(cell.id)}
                aria-label="Grid cell with {Math.floor(cell.value * 100)}% data density"
                tabindex="0"
            >
                <span class="sr-only">
                    Contains {cell.dataPoints} historical records
                </span>
            </button>
        {/each}
    </div>

    <!-- Tooltip -->
    {#if focusedCellData}
        {@const [x, y] = projectToPixel(focusedCellData.coordinates)}
        <div
            role="tooltip"
            class="absolute p-4 bg-white shadow-lg rounded-lg z-20"
            style="left: {x}px; top: {y}px"
        >
            <h3 class="font-bold text-sm">Cell Details</h3>
            <p class="text-sm">
                Coordinates: {focusedCellData.coordinates[0].toFixed(4)}, {focusedCellData.coordinates[1].toFixed(4)}
                <br />
                Data density: {Math.floor(focusedCellData.value * 100)}%
                <br />
                Records: {focusedCellData.dataPoints}
            </p>
        </div>
    {/if}
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
</style>

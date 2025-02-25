<script lang="ts">
	import { PUBLIC_MAPTILER_API_KEY } from '$env/static/public';
	import { onMount, onDestroy, createEventDispatcher } from 'svelte';
	import maplibre, { type Map } from 'maplibre-gl';
	import type {
		Heatmap,
		HeatmapCell,
		GridDimensions
	} from '@atm/shared-types';
	import debounce from 'lodash.debounce';
	import { mergeCss } from '$utils/utils';
	import 'maplibre-gl/dist/maplibre-gl.css';

	// WIP: this should be env import
	const STYLE_URL = `https://api.maptiler.com/maps/8b292bff-5b9a-4be2-aaea-22585e67cf10/style.json?key=${PUBLIC_MAPTILER_API_KEY}`;

	export let heatmap: Heatmap;
	//export let period: string;
	export let heatmapBlueprint: HeatmapCell[];
	export let dimensions: GridDimensions;
	export let className: string | undefined = undefined;
	export let selectedCellId: string | null = null;

	let showModal = false;
	let modalData = {
		id: '',
		coordinates: [] as number[][],
		position: { x: 0, y: 0 },
		value: undefined as number | undefined,
		count: undefined as number | undefined
	};

	let map: Map | undefined;
	let mapContainer: HTMLElement;
	let isMapLoaded = false;
	// Track which cells currently have values to optimize updates
	let activeCellIds = new Set<string>();

	const cellIdMap = new Map<number, string>();
	heatmapBlueprint.forEach(cell => {
			const index = cell.row * dimensions.colsAmount + cell.col;
			cellIdMap.set(index, cell.cellId);
			});

	const dispatch = createEventDispatcher<{
		cellClick: {
			id: string;
		};
	}>();

	// Generate initial features from blueprint
	function generateInitialFeatures(blueprint: HeatmapCell[]) {
		const features = blueprint.map((cell) => ({
			type: 'Feature',
			id: cell.cellId,
			properties: {
				id: cell.cellId,
				row: cell.row,
				col: cell.col,
				count: 0
			},
			geometry: {
				type: 'Polygon',
				coordinates: [
					[
						[cell.bounds.minLon, cell.bounds.minLat],
						[cell.bounds.maxLon, cell.bounds.minLat],
						[cell.bounds.maxLon, cell.bounds.maxLat],
						[cell.bounds.minLon, cell.bounds.maxLat],
						[cell.bounds.minLon, cell.bounds.minLat]
					]
				]
			}
		}));

		return {
			type: 'FeatureCollection',
			features
		};
	}

	const updateFeatureStates = debounce(
		(map: Map, heatmapData: Heatmap) => {

			const { densityArray, countArray } = heatmapData;

			const newActiveCellIds = new Set<string>();
				
			// Only iterate through values that exist in the array
			for (let i = 0; i < countArray.length; i++) {
				const count = countArray[i];
				if (count > 0) {

					const cellId = cellIdMap.get(i);
					if (cellId) {

						// Set the feature state for cells with values
						map.setFeatureState(
							{ source: 'grid', id: cellId },
							{
								value: densityArray[i] || 0,
								count
							}
						);
						newActiveCellIds.add(cellId);
					}
				}
			}
			
			// Clear cells inactive cells 
			activeCellIds.forEach(cellId => {
				if (!newActiveCellIds.has(cellId)) {
					map.setFeatureState(
						{ source: 'grid', id: cellId },
						{
							value: 0,
							count: 0
						}
					);
				}
			});
			
			// Update the tracking set
			activeCellIds = newActiveCellIds;
		},
		16
	);

	function updateSelectedCell(cellId: string | null) {
		if (!isMapLoaded || !map) return;

		// Clear previous highlight
		if (selectedCellId) {
			map.setFeatureState({ source: 'grid', id: selectedCellId }, { selected: false });
		}

		// Set new highlight
		if (cellId) {
			map.setFeatureState({ source: 'grid', id: cellId }, { selected: true });
		}
	}

	// Update feature states when heatmap changes
	$: if (isMapLoaded && map && heatmap) {
		updateFeatureStates(map, heatmap);
	}

	// Reactive statement calls the function
	$: updateSelectedCell(selectedCellId);

	onMount(() => {
		if (!mapContainer) return;

		const { minLon: west, maxLon: east, minLat: south, maxLat: north } = dimensions;

		map = new maplibre.Map({
			container: mapContainer,
			style: STYLE_URL,
			maxBounds: [
				[west, south],
				[east, north]
			],
			center: [4.895645, 52.372219], // amsterdam center
			minZoom: 12,
			maxZoom: 14,
			zoom: 13,
			dragRotate: false,
			touchZoomRotate: false,
			dragPan: true,
			keyboard: true,
			scrollZoom: true
		});

		map.on('load', () => {
			// Add source with blueprint features
			map.addSource('grid', {
				type: 'geojson',
				data: generateInitialFeatures(heatmapBlueprint),
				promoteId: 'id'
			});

			// Add layer using feature state for opacity with transition
			map.addLayer({
				id: 'heatmap-squares',
				type: 'fill',
				source: 'grid',
				paint: {
					'fill-color': '#0000ff',
					'fill-opacity': ['coalesce', ['feature-state', 'value'], 0]
				}
			});

			map.addLayer({
				id: 'selected-cell',
				type: 'line',
				source: 'grid',
				paint: {
					'line-color': '#ff0000',
					'line-width': 2,
					'line-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 1, 0]
				}
			});

			// Initial feature state setup
			updateFeatureStates(map, heatmap, heatmapBlueprint);

			// Event handlers
			map.on('mousemove', 'heatmap-squares', (e) => {
				if (e.features?.[0]) {
					const feature = e.features[0];
					const featureState = map.getFeatureState({ source: 'grid', id: feature.properties.id });

					if (featureState.count > 0) {
						showModal = true;
						modalData = {
							id: feature.properties.id,
							coordinates: feature.geometry.coordinates,
							position: { x: e.point.x, y: e.point.y },
							value: featureState.value || 0,
							count: featureState.count || 0
						};
						map.getCanvas().style.cursor = 'pointer';
					} else {
						showModal = false;
						map.getCanvas().style.cursor = '';
					}
				}
			});

			map.on('mouseleave', 'heatmap-squares', () => {
				showModal = false;
				map.getCanvas().style.cursor = '';
			});

			map.on('click', 'heatmap-squares', (e) => {
				if (e.features?.[0]) {
					const feature = e.features[0];
					const featureState = map.getFeatureState({ source: 'grid', id: feature.properties.id });

					// Only dispatch if the cell has a value
					if (featureState.count > 0) {
						dispatch('cellClick', {
							id: feature.properties.id,
							//period
						});
					}
				}
			});

			isMapLoaded = true;
		});
	});
	
	onDestroy(() => {
		if (map) {
			map.off('mousemove', 'heatmap-squares');
			map.off('mouseleave', 'heatmap-squares');
			map.off('click', 'heatmap-squares');
			map.off('mouseenter', 'heatmap-squares');
			updateFeatureStates.cancel();
			map.remove();
		}
	});
</script>

<div class={mergeCss('h-full w-full', className)}>
	<div bind:this={mapContainer} class="h-full w-full" />

	{#if showModal}
		<div
			class="absolute pointer-events-none bg-white shadow-lg p-1 z-50 transition-opacity duration-150"
			style="left: {modalData.position.x + 10}px; top: {modalData.position.y + 10}px"
		>
			<p class="text-sm">
				ID: {modalData.id}
				<br />
				{#if modalData.count !== undefined}
					Count: {modalData.count}
					<br />
				{/if}
				{#if modalData.value !== undefined}
					Intensity: {(modalData.value * 100).toFixed(1)}%
					<br />
				{/if}
			</p>
		</div>
	{/if}
</div>

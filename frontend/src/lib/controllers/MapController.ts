// src/lib/controllers/mapController.ts
import { browser } from '$app/environment';
import { page } from '$app/state';
import { pushState } from '$app/navigation';
import { fetchHeatmaps, fetchApi } from '$api';
import type { ContentClass, Heatmap, CellFeaturesResponse } from '@atm/shared-types';
import {
  PUBLIC_DEFAULT_CONTENT_CLASS,
  PUBLIC_SERVER_PROD_URL,
  PUBLIC_SERVER_DEV_URL
} from '$env/static/public';

export function createMapController(initialData: any) {
  // Core state
  let currentPeriod = $state<string | undefined>(undefined);
  let selectedClasses = $state(new Set<ContentClass>([PUBLIC_DEFAULT_CONTENT_CLASS]));
  let selectedTags = $state(new Set<string>());
  let isLoading = $state(false);
  let isLoadingNewPeriod = $state(false);
  let data = $state(initialData);
  
  // Previous state tracking for detecting changes
  let previousSelectedClasses = $state(new Set<ContentClass>());
  let previousSelectedTags = $state(new Set<string>());
  let previousPeriod = $state<string | undefined>(undefined);
  
  // Derived values
  let dimensions = $derived(data?.metadata?.dimensions);
  let heatmaps = $derived(data?.heatmaps?.heatmaps as Record<string, Heatmap>);
  let heatmapBlueprint = $derived(data?.metadata?.heatmapBlueprint?.cells);
  let featuresStatistics = $derived(data?.metadata?.featuresStatistics);
  let timePeriods = $derived(data?.metadata?.timePeriods);
  
  // Helper function to compare sets
  function hasSelectionChanged(current: Set<any>, previous: Set<any>): boolean {
    if (current.size !== previous.size) return true;
    
    for (const item of current) {
      if (!previous.has(item)) return true;
    }
    
    return false;
  }
  
  function buildCellApiUrl(cellId: string, period: string): string {
    const baseUrl = import.meta.env.MODE === 'production' 
      ? PUBLIC_SERVER_PROD_URL 
      : PUBLIC_SERVER_DEV_URL;
      
    let apiUrl = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=1`;
    
    const params = new URLSearchParams();
    if (selectedClasses.size > 0) {
      const classesString = Array.from(selectedClasses).join(',');
      params.set('contentClasses', classesString);
      apiUrl += `&contentClasses=${classesString}`;
    }
    
    if (selectedTags.size > 0) {
      const tagsString = Array.from(selectedTags).join(',');
      params.set('tags', tagsString);
      apiUrl += `&tags=${tagsString}`;
    }
    
    return apiUrl;
  }
  
  function buildCellRoute(cellId: string, period: string): string {
    let cellRoute = `/cells/${period}/${cellId}`;
    
    const params = new URLSearchParams();
    if (selectedClasses.size > 0) {
      params.set('contentClasses', Array.from(selectedClasses).join(','));
    }
    if (selectedTags.size > 0) {
      params.set('tags', Array.from(selectedTags).join(','));
    }
    
    const queryString = params.toString();
    if (queryString) {
      cellRoute += `?${queryString}`;
    }
    
    return cellRoute;
  }
  
  // ------ Public Methods ------
  
  async function initialize(): Promise<void> {
    if (browser) {
      // Get parameters from URL if present
      const contentClassesParam = page.url.searchParams.get('contentClasses');
      const tagsParam = page.url.searchParams.get('tags');
      
      // Initialize selected classes from URL or default
      if (contentClassesParam) {
        selectedClasses = new Set(contentClassesParam.split(',') as ContentClass[]);
      } else if (PUBLIC_DEFAULT_CONTENT_CLASS) {
        selectedClasses = new Set([PUBLIC_DEFAULT_CONTENT_CLASS]);
      }
      
      // Initialize selected tags from URL
      if (tagsParam) {
        selectedTags = new Set(tagsParam.split(','));
      }
      
      // Set initial period if available
      if (timePeriods && timePeriods.length > 0) {
        currentPeriod = timePeriods[0];
      }
      
      // Initial data fetch
      await updateHeatmaps();
    }
  }
  
  // Helper to get selected classes as array
  function getSelectedClassesArray(): ContentClass[] {
    return Array.from(selectedClasses);
  }
  
  // Helper to get selected tags as array
  function getSelectedTagsArray(): string[] {
    return Array.from(selectedTags);
  }
  
  // Get current heatmap based on period
  function getCurrentHeatmap(): Heatmap | null {
    return currentPeriod && heatmaps ? heatmaps[currentPeriod] : null;
  }
  
  // Get the currently selected cell ID
  function getSelectedCellId(): string | undefined {
    return page.state.selectedCell?.cellFeatures.cellId;
  }
  
  // Handler for class selection changes
  function handleClassesChange(classes: ContentClass[]): void {
    selectedClasses = new Set(classes);
  }
  
  // Handler for tag selection changes
  function handleTagsChange(tags: string[]): void {
    selectedTags = new Set(tags);
  }
  
  // Update heatmaps based on current selections
  async function updateHeatmaps(): Promise<void> {
    isLoading = true;
    
    try {
      const response = await fetchHeatmaps(selectedClasses, selectedTags);
      data.heatmaps = response;
    } catch (error) {
      console.error('Error fetching heatmaps:', error);
    } finally {
      isLoading = false;
    }
  }
  
  // Handle cell selection
  async function selectCell(cellId: string | null): Promise<void> {
    // If cellId is null, clear the selection
    if (cellId === null || !currentPeriod) {
      pushState('/', {
        selectedCell: undefined
      });
      return;
    }
    
    const cellRoute = buildCellRoute(cellId, currentPeriod);
    const apiUrl = buildCellApiUrl(cellId, currentPeriod);
    
    try {
      // Fetch cell data
      const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl);
      
      // Navigate with both URL parameters and state
      pushState(cellRoute, {
        selectedCell: { cellFeatures }
      });
    } catch (error) {
      console.error('Error fetching cell data:', error);
    }
  }
  
  // Update URL from current selections
  function updateUrlFromSelections(): void {
    if (!browser) return;
    
    const url = new URL(window.location.href);
    
    // Update URL parameters without triggering navigation
    if (selectedClasses.size > 0) {
      url.searchParams.set('contentClasses', Array.from(selectedClasses).join(','));
    } else {
      url.searchParams.delete('contentClasses');
    }
    
    if (selectedTags.size > 0) {
      url.searchParams.set('tags', Array.from(selectedTags).join(','));
    } else {
      url.searchParams.delete('tags');
    }
    
    // Update browser history without full page reload
    history.replaceState({}, '', url.toString());
  }
  
  // Update selected cell with new filters
  async function updateCellWithFilters(): Promise<void> {
    if (!browser || !page.state.selectedCell) return;
    
    // Get the currently selected cell ID and period
    const cellId = page.state.selectedCell.cellFeatures.cellId;
    if (!cellId || !currentPeriod) return;
    
    const cellRoute = buildCellRoute(cellId, currentPeriod);
    const apiUrl = buildCellApiUrl(cellId, currentPeriod);
    
    try {
      // Fetch updated cell data
      const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl);
      
      // Update the route and state
      pushState(cellRoute, {
        selectedCell: { cellFeatures }
      });
    } catch (error) {
      console.error('Error updating cell for new content classes:', error);
    }
  }
  
  // Update selected cell with new period
  async function updateCellWithPeriod(): Promise<void> {
    if (!browser || !page.state.selectedCell || !currentPeriod) return;
    
    isLoadingNewPeriod = true;
    
    // Get the currently selected cell ID
    const cellId = page.state.selectedCell.cellFeatures.cellId;
    if (!cellId) return;
    
    const cellRoute = buildCellRoute(cellId, currentPeriod);
    const apiUrl = buildCellApiUrl(cellId, currentPeriod);
    
    try {
      // Fetch and update
      const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl);
      
      // Update the route and state
      pushState(cellRoute, {
        selectedCell: { cellFeatures }
      });
    } catch (error) {
      console.error('Error updating cell for new period:', error);
    } finally {
      isLoadingNewPeriod = false;
    }
  }
  
  // ------ Effects ------
  
  // Effect to watch for changes in selections and fetch new data
  $effect(() => {
    if (selectedClasses.size > 0 && browser) {
      console.log('Selection changed, fetching new heatmaps...');
      updateHeatmaps();
    }
    
    previousSelectedClasses = new Set(selectedClasses);
    previousSelectedTags = new Set(selectedTags);
  });
  
  // Effect to update URL when selections change
  $effect(() => {
    if (browser && (selectedClasses.size > 0 || selectedTags.size > 0)) {
      updateUrlFromSelections();
    }
  });
  
  // Effect to update the cell when content classes or tags change
  $effect(() => {
    if (browser && page.state.selectedCell && 
      (hasSelectionChanged(selectedClasses, previousSelectedClasses) || 
      hasSelectionChanged(selectedTags, previousSelectedTags))) {
      
      updateCellWithFilters();
    }
  });
  
  // Effect to update the cell when currentPeriod changes
  $effect(() => {
    if (browser && currentPeriod && currentPeriod !== previousPeriod && page.state.selectedCell) {
      updateCellWithPeriod();
    }
    
    // Update previous period
    previousPeriod = currentPeriod;
  });
  
  // Return public interface
  return {
    // State getters/setters
    get currentPeriod() { return currentPeriod; },
    set currentPeriod(value: string | undefined) { currentPeriod = value; },
    get isLoading() { return isLoading; },
    get isLoadingNewPeriod() { return isLoadingNewPeriod; },
    get dimensions() { return dimensions; },
    get heatmaps() { return heatmaps; },
    get heatmapBlueprint() { return heatmapBlueprint; },
    get featuresStatistics() { return featuresStatistics; },
    get timePeriods() { return timePeriods; },
    
    // Public methods
    initialize,
    getSelectedClassesArray,
    getSelectedTagsArray,
    getCurrentHeatmap,
    getSelectedCellId,
    handleClassesChange,
    handleTagsChange,
    selectCell,
    updateHeatmaps
  };
}

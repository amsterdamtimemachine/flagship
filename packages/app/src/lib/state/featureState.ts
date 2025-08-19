// featureState.ts - Global state for feature detail viewing
import type { RawFeature } from '@atm/shared/types';

// Global state using Svelte 5 $state
let selectedFeature = $state<RawFeature | null>(null);

// Export reactive state with methods
export const featureViewerState = {
  get selectedFeature() { 
    return selectedFeature; 
  },
  
  openFeature(feature: RawFeature) {
    console.log('🔍 Opening feature for detailed view:', feature);
    selectedFeature = feature;
  },
  
  closeFeature() {
    console.log('❌ Closing feature detail view');
    selectedFeature = null;
  },
  
  get isOpen() {
    return selectedFeature !== null;
  }
};
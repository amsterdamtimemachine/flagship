// featureState.ts - Global state for feature detail viewing
import type { Feature } from '@atm/shared/types';

let selectedFeature = $state<Feature | null>(null);

export const featureViewerState = {
  get selectedFeature() { 
    return selectedFeature; 
  },
  
  openFeature(feature: Feature) {
    selectedFeature = feature;
  },
  
  closeFeature() {
    selectedFeature = null;
  },
  
  get isOpen() {
    return selectedFeature !== null;
  }
};

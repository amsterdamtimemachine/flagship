import { extractGeoFeaturesFromGeoJsonFolder, gridifyGeoFeatures } from './processing';
import type { GridConfig } from '@atm/shared-types';

const GRID_CONFIG: GridConfig = {
    width_n: 10,
    height_n: 10,
    boundA: [4.73, 52.7],  // Amsterdam bounds
    boundB: [5.3, 51.9]
};

async function preprocessData() {
    const features = await extractGeoFeaturesFromGeoJsonFolder('./src/data'); 
    const gridifiedFeatures = gridifyGeoFeatures(features, GRID_CONFIG);
    
    // 3. Create binary file
    // TODO: Serialize processedGrid and features to binary
}

preprocessData();

//export { processGeoFolder };

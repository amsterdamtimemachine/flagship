import { extractGeoFeaturesFromGeoJsonFolder, gridifyGeoFeatures } from './processing';
import { serializeToBinary } from './serialisation'
import type { GridConfig } from '@atm/shared-types';

const GRID_CONFIG: GridConfig = {
    colsAmount: 10,
    rowsAmount: 10,
    boundA: [4.73, 52.7],  
    boundB: [5.3, 51.9]
};

async function preprocessData() {
    console.log("STARTING");
    const options = { dropNulls: true, convertMetersToLatLon: true };
    const features = await extractGeoFeaturesFromGeoJsonFolder('/home/m/Downloads/reprojections/3857', options);
    const gridifiedFeatures = gridifyGeoFeatures(features, GRID_CONFIG);

    await serializeToBinary(
        features, 
        gridifiedFeatures, 
        './data/grid.bin'
    );
}

preprocessData();

//export { processGeoFolder };

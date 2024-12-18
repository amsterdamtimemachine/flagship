import { getGridDimensionsFromConfig } from './processing';
import { processGeoJsonFolderToFeatures, 
         type GeoJsonProcessingOptions,
         processFeaturesToGrid } from './processingStream'; 
import type { GridConfig } from '@atm/shared-types';

const GRID_CONFIG: GridConfig = {
    colsAmount: 10,
    rowsAmount: 10,
    boundA: [4.73, 52.7],  
    boundB: [5.3, 51.9]
};

const PROCESS_FOLDER = false;

async function preprocessData() {
   const geoJsonFeaturesFolder = '/home/m/Downloads/reprojections/3857';
   const processedJsonPath = './temp/processed_features.json';

   if (PROCESS_FOLDER) {
       const options : GeoJsonProcessingOptions = { dropNulls: true, convertMetersToLatLon: true };
       await processGeoJsonFolderToFeatures(
           geoJsonFeaturesFolder,
           processedJsonPath,
           options
       );
  }

  console.log("starting bin processing");

  const gridDimensions =getGridDimensionsFromConfig(GRID_CONFIG);
  const gridBinaryFilePath = '/atm/public/new_grid.bin'

   await processFeaturesToGrid(
    processedJsonPath,
    gridBinaryFilePath,
    gridDimensions)

    console.log("finished processing");
}

await preprocessData();


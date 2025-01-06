import { processGeoJsonFolderToFeatures, 
         type GeoJsonProcessingOptions,
         processFeaturesToGrid,
         getGridDimensionsFromConfig } from './grid'; 
import type { GridConfig } from '@atm/shared-types';

const GRID_CONFIG: GridConfig = {
    colsAmount: 10,
    rowsAmount: 10,
    boundA: [4.73, 52.7],  
    boundB: [5.3, 51.9]
};

const PREPROCESS = false;

async function preprocessAndSaveData() {
   const geoJsonFeaturesFolder = '/home/m/Downloads/reprojections/3857';
   const processedJsonPath = './temp/processed_features.json';

   if (PREPROCESS) {
       console.log(`starting geojson folder ${geoJsonFeaturesFolder} processing.`);
       const options : GeoJsonProcessingOptions = { dropNulls: true, convertMetersToLatLon: true };
       await processGeoJsonFolderToFeatures(
           geoJsonFeaturesFolder,
           processedJsonPath,
           options
       ); 
       console.log("finished geojson processing");
  }

  console.log("starting bin processing");

  const gridDimensions = getGridDimensionsFromConfig(GRID_CONFIG);
  const gridBinaryFilePath = '/atm/public/geodata.bin'

   await processFeaturesToGrid(
    processedJsonPath,
    gridBinaryFilePath,
    gridDimensions)

    console.log(`finished processing, bin saved to ${gridBinaryFilePath}`);
}
await preprocessAndSaveData();


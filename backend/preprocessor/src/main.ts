import { processGeoJsonFolderToFeatures, 
         type GeoJsonProcessingOptions,
         processFeaturesToGrid,
         getGridDimensionsFromConfig } from './grid'; 
import type { GridConfig } from '@atm/shared-types';

const GRID_CONFIG: GridConfig = {
    colsAmount: 100,
    rowsAmount: 100,
    padding: 0.0,

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

  //const gridDimensions = getGridDimensionsFromConfig(GRID_CONFIG);
  const gridBinaryFilePath = '/atm/public/geodata.bin'

   await processFeaturesToGrid(
    processedJsonPath,
    gridBinaryFilePath,
    GRID_CONFIG)

    console.log(`finished processing, bin saved to ${gridBinaryFilePath}`);
}
await preprocessAndSaveData();


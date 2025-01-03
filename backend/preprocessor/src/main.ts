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

async function preprocessData() {
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
  const gridBinaryFilePath = '/atm/public/min_bin2.bin'

   await processFeaturesToGrid(
    processedJsonPath,
    gridBinaryFilePath,
    gridDimensions)

    console.log(`finished processing, bin saved to ${gridBinaryFilePath}`);
}
await preprocessData();
//
//
//
// import { encode } from '@msgpack/msgpack';
// import * as fs from 'node:fs/promises';
// 
// interface TestFeature {
//     value: string;
// }
// 
// async function writeTestFile(path: string) {
//     const features = [{ value: "test1" }, { value: "test2" }];
//     const encodedFeatures = encode(features);
// 
//     const cellIndices = {
//         "0_0": { startOffset: 0, endOffset: encodedFeatures.byteLength, featureCount: features.length },
//     };
//     const metadata = { version: 1, dimensions: [1, 1], cellIndices };
//     const encodedMetadata = encode(metadata);
// 
//     const metadataSize = encodedMetadata.byteLength;
//     const sizeBuffer = Buffer.allocUnsafe(4);
//     sizeBuffer.writeUInt32BE(metadataSize, 0);
// 
//     await fs.writeFile(path, Buffer.concat([sizeBuffer, encodedMetadata, encodedFeatures]));
// }
// 
// async function main() {
//     await writeTestFile("/atm/public/test.bin");
// }
// 
// main();

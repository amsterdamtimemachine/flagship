import { processGeoJsonFolderToFeatures, 
         type GeoJsonProcessingOptions,
         //processFeaturesToTimeBinary,
         calculateGridDimensions } from './grid'; 

import { printObjectFields } from './utils';

import { processFeatures, saveFeaturesToBinary, testBinaryLoading } from './grid_grains';

const PREPROCESS = false;

async function preprocessAndSaveData() {
    const geoJsonFeaturesFolder = '/atm/data/tagged';
    const processedJsonPath = '/atm/data/tagged/processed.json';
    const binaryPath = '/atm/data/tagged/dataset.bin';
    
    if (PREPROCESS) {
        console.log(`Starting geojson folder ${geoJsonFeaturesFolder} processing.`);
        const options: GeoJsonProcessingOptions = { 
            dropNulls: true, 
            dropUndated: true,
            convertMetersToLatLon: false 
        };
        
        await processGeoJsonFolderToFeatures(
            geoJsonFeaturesFolder,
            processedJsonPath,
            options
        ); 
        console.log("Finished geojson processing");
    }
    
   // console.log("Starting bin processing");
    const gridDimensions = await calculateGridDimensions(processedJsonPath, {
        colsAmount: 200,
        rowsAmount: 200,
        padding: 0.0,
    });
   // 
   // const gridBinaryFilePath = '/atm/public/timegeodata3.bin';

   // await processFeaturesToTimeBinary(
   //     processedJsonPath,
   //     gridBinaryFilePath,
   //     gridDimensions,
   //     { pageSize: 25, sliceYears: 50 },
   // );

    
  // const res = await processFeaturesToTimeBinary(
  //      processedJsonPath,
  //      gridDimensions,
  //      { pageSize: 25, sliceYears: 50 },
  //  );
    //
    //
   // console.log("processing!");
    let features = await processFeatures(processedJsonPath, gridDimensions, {sliceYears: 50, pageSize: 25})
    saveFeaturesToBinary(features, binaryPath);
    console.log("done");
    testBinaryLoading(binaryPath);
    //await testBinaryOffsets(processedJsonPath, "test.bin", gridDimensions, { sliceYears: 10, pageSize: 25 });

  //  console.log(printObjectFields(res.timeSlices["1600_1650"]));
    //console.log(`Finished processing, bin saved to ${gridBinaryFilePath}`);
}


await preprocessAndSaveData();


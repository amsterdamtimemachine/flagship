import { processGeoJsonFolderToFeatures, 
         type GeoJsonProcessingOptions,
         processFeaturesToGrid,
         calculateGridDimensions } from './grid'; 

const PREPROCESS = false;

async function preprocessAndSaveData() {
    const geoJsonFeaturesFolder = '/home/m/Downloads/reprojections/3857';
    const processedJsonPath = './temp/processed_features.json';
    
    if (PREPROCESS) {
        console.log(`Starting geojson folder ${geoJsonFeaturesFolder} processing.`);
        const options: GeoJsonProcessingOptions = { 
            dropNulls: true, 
            dropUndated: true,
            convertMetersToLatLon: true 
        };
        
        await processGeoJsonFolderToFeatures(
            geoJsonFeaturesFolder,
            processedJsonPath,
            options
        ); 
        console.log("Finished geojson processing");
    }
    
    console.log("Starting bin processing");
    const gridDimensions = await calculateGridDimensions(processedJsonPath, {
        colsAmount: 500,
        rowsAmount: 500,
        padding: 0.0,
    });
    
    const gridBinaryFilePath = '/atm/public/timegeodata2.bin';
    await processFeaturesToGrid(
        processedJsonPath,
        gridBinaryFilePath,
        gridDimensions
    );
    
    console.log(`Finished processing, bin saved to ${gridBinaryFilePath}`);
}


await preprocessAndSaveData();


import { readdirSync } from 'fs';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const INPUT_DIR = '/home/m/Downloads/not_reprojected_tagged';  
const OUTPUT_DIR = '/atm/data/tagged/';  

try {
    await mkdir(OUTPUT_DIR, { recursive: true });
} catch (error) {
    if (error.code !== 'EEXIST') {
        throw error;
    }
}


function processFeature(feature: any) {
    // Add content type and class at root level
    const processedFeature = {
        ...feature,                    // Spread all existing properties
        content_type: 'image',
        content_class: 'Image'
    };

    if (feature.properties) {
        const props = feature.properties;
        
        // Restructure AI tags
        if (props.tags) {
            processedFeature.properties = {
                ...props,              // Keep all other properties
                ai: {
                    environment: props.tags.env,
                    tags: props.tags.cats.map((cat: [string, string]) => cat[0]),
                    attributes: props.tags.attribs
                }
            };

            // Delete duplicate fields
            delete processedFeature.properties.tags;
            delete processedFeature.properties.tags_env;
            delete processedFeature.properties.tags_attribs;
            delete processedFeature.properties.tags_cats;
        }
    }

    return processedFeature;
}

async function processGeoJsonFile(filePath: string) {
    try {
        console.log(`Processing ${filePath}`);
        const content = await Bun.file(filePath).text();
        const geojson = JSON.parse(content);

        // Process each feature
        geojson.features = geojson.features.map(processFeature);

        // Write processed file
        const outputPath = join(OUTPUT_DIR, filePath.split('/').pop()!);
        await Bun.write(outputPath, JSON.stringify(geojson, null, 2));
        
        console.log(`Completed ${filePath}`);
    } catch (error) {
        console.error(`Error processing ${filePath}:`, error);
    }
}

async function main() {
    const files = readdirSync(INPUT_DIR)
        .filter(file => file.endsWith('.geojson'));

    console.log(`Found ${files.length} GeoJSON files`);

    for (const file of files) {
        await processGeoJsonFile(join(INPUT_DIR, file));
    }

    console.log('Processing complete');
}

main().catch(console.error);

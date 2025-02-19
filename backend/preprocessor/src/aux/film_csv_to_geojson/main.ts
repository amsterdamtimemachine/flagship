import {type ColumnMapping, processCSV} from './processing';

// Usage example
async function main() {
    const config: ColumnMapping = {
        title: "title",
        coordinates: "geodata",
        info: "info",
        start_date: "programme_date",
        street_name: "street_name",
        city_name: "city_name",
        venue_type: "venue_type",
        //source: , 
       // aiTags: {
       //     venueType: "venue_type",
       //     attendance: "audience_size",
       //     price: "ticket_price"
       // }
    };

    try {
        const result = await processCSV('/home/m/Downloads/tblFilm.csv', config);
        console.log(`Processed ${result.processedRows} rows`);
        console.log(`Skipped ${result.skippedRows} rows`);

        if (result.features.length > 0) {
            await Bun.write('/atm/data/tagged/tblFilm.geojson', JSON.stringify({
                type: 'FeatureCollection',
                features: result.features
            }, null, 2));
            console.log('Output written to output.geojson');
        }
    } catch (error) {
        console.error('Processing failed:', error);
    }
}

main().catch(console.error);

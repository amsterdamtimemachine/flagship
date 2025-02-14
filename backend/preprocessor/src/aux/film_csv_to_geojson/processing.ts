import type { DataType, FeatureClass, GeoFeature, TextProperties } from '@atm/shared-types';
import { parseCSV } from './csvParser';

interface ColumnMapping {
    title: string;
    url: string;
    start_date: string;
    end_date: string;
    latitude: string;
    longitude: string;
    content: string;
    aiTags?: Record<string, string>;
}

interface ProcessingResult {
    features: GeoFeature[];
    skippedRows: number;
    processedRows: number;
}

function transformRow(
    row: Record<string, unknown>,
    config: ColumnMapping
): GeoFeature | null {
    try {
        const aiTags: Record<string, unknown> = {};
        if (config.aiTags) {
            for (const [tagName, columnName] of Object.entries(config.aiTags)) {
                if (columnName in row) {
                    aiTags[tagName] = row[columnName];
                }
            }
        }

        return {
            type: "Feature",
            properties: {
                dataType: "text",
                featureClass: "FilmScreening",
                url: String(row[config.url]),
                title: String(row[config.title]),
                start_date: String(row[config.start_date]),
                end_date: String(row[config.end_date]),
                content: String(row[config.content]),
                aiTags: Object.keys(aiTags).length > 0 ? aiTags : undefined
            },
            geometry: {
                type: "Point",
                coordinates: [
                    Number(row[config.longitude]),
                    Number(row[config.latitude])
                ]
            }
        };
    } catch (error) {
        return null;
    }
}

async function processCSV(
    filePath: string,
    config: ColumnMapping
): Promise<ProcessingResult> {
    const csvContent = await Bun.file(filePath).text();
    const { data, headers } = parseCSV(csvContent);

    const result: ProcessingResult = {
        features: [],
        processedRows: 0,
        skippedRows: 0
    };

    data.forEach(row => {
        const feature = transformRow(row, config);
        if (feature) {
            result.features.push(feature);
            result.processedRows++;
        } else {
            result.skippedRows++;
        }
    });

    return result;
}

// Usage example
async function main() {
    const config: ColumnMapping = {
        title: "event_name",
        url: "source_url",
        start_date: "date_start",
        end_date: "date_end",
        latitude: "venue_latitude",
        longitude: "venue_longitude",
        content: "description",
        aiTags: {
            venueType: "venue_type",
            attendance: "audience_size",
            price: "ticket_price"
        }
    };

    try {
        const result = await processCSV('input.csv', config);
        console.log(`Processed ${result.processedRows} rows`);
        console.log(`Skipped ${result.skippedRows} rows`);

        if (result.features.length > 0) {
            await Bun.write('output.geojson', JSON.stringify({
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

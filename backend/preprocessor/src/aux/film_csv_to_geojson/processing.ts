import type { GeoFeature, BaseProperties } from '@atm/shared-types';
import { parseCSV } from './csvParser';

interface FilmScreeningMapping {
    title: string;
    coordinates: string;
    info: string;
    street_name: string;
    city_name: string;
    venue_type: string;
    start_date: string;
    end_date?: string;
    source?: string;
    ai_env?: string;
    ai_tags?: string;      
    ai_attributes?: string;
}

export type ColumnMapping = FilmScreeningMapping;

interface ProcessingResult {
    features: GeoFeature<'Event'>;
    skippedRows: number;
    processedRows: number;
}

function parseCoordinates(coords: string): [number, number] {
    const [lat, lon] = coords.split(',').map(Number);
    if (isNaN(lat) || isNaN(lon)) {
        throw new Error('Invalid coordinates format');
    }
    return [lat, lon];
}

function transformRow(
    row: Record<string, unknown>,
    config: ColumnMapping
): GeoFeature<'Event'> | null {
    try {
        // Process AI fields
        const ai: BaseProperties['ai'] = {};
        
        if (config.ai_env && row[config.ai_env]) {
            ai.env = String(row[config.ai_env]);
        }
        
        if (config.ai_tags && row[config.ai_tags]) {
            ai.tags = String(row[config.ai_tags])
                .split(',')
                .map(tag => tag.trim())
                .filter(Boolean);
        }
        
        if (config.ai_attributes && row[config.ai_attributes]) {
            ai.attributes = String(row[config.ai_attributes])
                .split(',')
                .map(attr => attr.trim())
                .filter(Boolean);
        }

        return {
            type: "Feature",
            content_type: 'text',
            content_class: 'Event',
            properties: {
                title: String(row[config.title]),
                start_date: String(row[config.start_date]),
                end_date: config.end_date ? String(row[config.end_date]) : undefined,
                source: config.source ? String(row[config.source]) : undefined,
                street_name: String(row[config.street_name]),
                city_name: String(row[config.city_name]),
                info: String(row[config.info]),
                venue_type: String(row[config.venue_type]),
                ai: Object.keys(ai).length > 0 ? ai : undefined
            },
            geometry: {
                type: "Point",
                coordinates: parseCoordinates(String(row[config.coordinates])),
            }
        };
    } catch (error) {
        return null;
    }
}
export async function processCSV(
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

import type { GeoFeature, FilmScreeningProperties } from '@atm/shared-types';
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
    aiTags?: Record<string, string>;
}

export type ColumnMapping = FilmScreeningMapping;

interface ProcessingResult {
    features: GeoFeature[];
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
        const properties: FilmScreeningProperties = {
            data_type: "text",
            feature_class: "FilmScreening",
            title: String(row[config.title]),
            start_date: String(row[config.start_date]),
            end_date: config.end_date ? String(row[config.end_date]) : undefined,
            source: config.source ? String(row[config.source]) : undefined,
            street_name: String(row[config.street_name]),
            city_name: String(row[config.city_name]),
            info: String(row[config.info]),
            venue_type: String(row[config.venue_type]),
            aiTags: Object.keys(aiTags).length > 0 ? aiTags : undefined
        };

        return {
            type: "Feature",
            properties,
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

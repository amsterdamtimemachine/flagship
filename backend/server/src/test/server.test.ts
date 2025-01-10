import { expect, test } from "bun:test";
import type { GeoFeature, BinaryMetadata, Heatmap, HeatmapResponse } from '@atm/shared-types';
import { config } from '../config';

async function testGridCell(cellId: string): Promise<{
    status: number;
    data?: {
        cellId: string;
        featureCount: number;
        features: GeoFeature[];
    };
    error?: string;
}> {
    const response = await fetch(`${config.baseUrl}/grid/cell/${cellId}`);
    const data = await response.json();
    return {
        status: response.status,
        ...(response.ok ? { data } : { error: data.error })
    };
}

async function testMetadata(): Promise<{
    status: number;
    data?: BinaryMetadata,
    error?: string;
}> {
    const response = await fetch(`${config.baseUrl}/grid/metadata`);
    const data = await response.json();
    return {
        status: response.status,
        ...(response.ok ? { data } : { error: data.error })
    };
}

async function testHeatmap(): Promise<{
    status: number;
    data?: HeatmapResponse;
    error?: string;
}> {
    const response = await fetch(`${config.baseUrl}/grid/heatmap`);
    const data = await response.json();
    return {
        status: response.status,
        ...(response.ok ? { data } : { error: data.error })
    };
}

// Helper function to get a valid cell ID
async function getValidCellId(): Promise<string> {
    const metadata = await testMetadata();
    if (!metadata.data) throw new Error("Could not fetch metadata");
    if (!metadata.data.cellIndices) throw new Error("No cell indices in metadata");
    
    // Get the first few cell IDs from metadata and log them for debugging
    const metadataCells = Object.keys(metadata.data.cellIndices);
    console.log("Available cells:", metadataCells.slice(0, 5), `(total: ${metadataCells.length})`);
    
    const firstThreeCells = metadataCells.slice(0, 3);
    
    for (const cellId of firstThreeCells) {
        const result = await testGridCell(cellId);
        if (result.status === 200 && result.data?.features.length! > 0) {
            return cellId;
        }
    }
    
    // If none of the first cells work, try the rest
    for (const cellId of metadataCells.slice(3)) {
        const result = await testGridCell(cellId);
        if (result.status === 200 && result.data?.features.length! > 0) {
            return cellId;
        }
    }
    
    throw new Error("No valid cell ID found with features");
}

// Store validCellId in module scope
let validCellId: string;

test("setup", async () => {
    validCellId = await getValidCellId();
    console.log(`Using valid cell ID for tests: ${validCellId}`);
});

test("metadata endpoint returns correct structure", async () => {
    const result = await testMetadata();
    console.log("Metadata response:", JSON.stringify(result.data, null, 2));
    
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(result.data?.dimensions).toBeDefined();
    expect(result.data?.cellIndices).toBeDefined();
    
    const { dimensions } = result.data!;
    expect(dimensions.colsAmount).toBeGreaterThan(0);
    expect(dimensions.rowsAmount).toBeGreaterThan(0);
    expect(dimensions.minLon).toBeDefined();
    expect(dimensions.maxLon).toBeDefined();
    expect(dimensions.minLat).toBeDefined();
    expect(dimensions.maxLat).toBeDefined();

});test("grid cell endpoint returns valid data for existing cell", async () => {
    const result = await testGridCell(validCellId);
    
    expect(result.status).toBe(200);
    expect(result.data).toBeDefined();
    expect(Array.isArray(result.data?.features)).toBe(true);
    expect(typeof result.data?.featureCount).toBe('number');
    
    if (result.data && result.data.features && result.data.features.length > 0) {
        const feature = result.data.features[0];
        expect(feature).toBeDefined();
        expect(feature?.type).toBe('Feature');
        expect(feature?.properties).toBeDefined();
        expect(feature?.properties?.url).toBeDefined();
        expect(feature?.properties?.title).toBeDefined();
        expect(feature?.geometry).toBeDefined();
        
        if (feature) {
            expect('type' in feature).toBe(true);
            expect('properties' in feature).toBe(true);
            expect('geometry' in feature).toBe(true);
            
            if ('geometry' in feature && feature.geometry) {
                expect('type' in feature.geometry).toBe(true);
                expect('coordinates' in feature.geometry).toBe(true);
            }
        }
    }
});

test("grid cell endpoint handles invalid cell ID", async () => {
    const result = await testGridCell('invalid_id');
    expect(result.status).toBe(400);
    expect(result.error).toBeDefined();
});

test("grid cell endpoint handles non-existent cell", async () => {
    const result = await testGridCell('99_99');
    expect(result.status).toBe(404);
    expect(result.error).toBeDefined();
});

test("handles multiple concurrent requests", async () => {
    // Use the same valid cell ID for all requests since we know it works
    const promises = Array(5).fill(validCellId).map(cellId => testGridCell(cellId));
    const results = await Promise.all(promises);
    
    results.forEach(result => {
        expect(result.status).toBe(200);
        expect(result.data).toBeDefined();
    });
});

// Update heatmap tests
test("heatmap endpoint basic response", async () => {
    const response = await testHeatmap();
    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data?.cells).toBeDefined();
    expect(Array.isArray(response.data?.cells)).toBe(true);
});

test("heatmap cells array has correct structure", async () => {
   const response = await testHeatmap();
   const { cells } = response.data!;

   cells.forEach(cell => {
       expect(cell).toHaveProperty('cellId');
       expect(cell).toHaveProperty('row');
       expect(cell).toHaveProperty('col');
       expect(cell).toHaveProperty('featureCount');
       expect(cell).toHaveProperty('bounds');
       expect(cell.featureCount).toBeGreaterThan(0);
       
       expect(cell.bounds).toEqual({
           minLon: expect.any(Number),
           maxLon: expect.any(Number),
           minLat: expect.any(Number),
           maxLat: expect.any(Number)
       });
   });
});

test("cell indices have correct structure", async () => {
   const result = await testMetadata();
   const cellIndices = result.data!.cellIndices;

   Object.values(cellIndices).forEach(index => {
       expect(index).toHaveProperty('startOffset');
       expect(index).toHaveProperty('endOffset');
       expect(index).toHaveProperty('featureCount');
       expect(index).not.toHaveProperty('bounds');
   });
});

// Remove or modify tests that assume empty cells
test("heatmap only includes non-empty cells", async () => {
    const response = await testHeatmap();
    const { cells } = response.data!;

    // All cells should have features
    expect(cells.every(cell => cell.featureCount > 0)).toBe(true);
    
    // Should have some cells with data
    expect(cells.length).toBeGreaterThan(0);
});

test("heatmap endpoint returns time-related metadata", async () => {
    const response = await testHeatmap();
    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data?.timeRange).toBeDefined();
    expect(response.data?.availablePeriods).toBeDefined();
    expect(Array.isArray(response.data?.availablePeriods)).toBe(true);
    expect(response.data?.availablePeriods.length).toBeGreaterThan(0);
});

test("heatmap endpoint handles period parameter", async () => {
    // First get available periods
    const initialResponse = await testHeatmap();
    const firstPeriod = initialResponse.data?.availablePeriods[0];
    expect(firstPeriod).toBeDefined();

    // Test with specific period
    const response = await fetch(`${config.baseUrl}/grid/heatmap?period=${firstPeriod}`);
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.period).toBe(firstPeriod);
    expect(Array.isArray(data.cells)).toBe(true);
});

test("heatmap response structure matches interface", async () => {
    const response = await testHeatmap();
    expect(response.data).toMatchObject({
        period: expect.any(String),
        cells: expect.any(Array),
        timeRange: {
            start: expect.any(String),
            end: expect.any(String)
        },
        availablePeriods: expect.any(Array)
    });

    // Check cell structure
    if (response.data?.cells.length) {
        const cell = response.data.cells[0];
        expect(cell).toMatchObject({
            cellId: expect.any(String),
            row: expect.any(Number),
            col: expect.any(Number),
            featureCount: expect.any(Number),
            bounds: {
                minLon: expect.any(Number),
                maxLon: expect.any(Number),
                minLat: expect.any(Number),
                maxLat: expect.any(Number)
            }
        });
    }
});

test("heatmap endpoint handles invalid period", async () => {
    const response = await fetch(`${config.baseUrl}/grid/heatmap?period=invalid-period`);
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBeDefined();
});

test("heatmap cells are consistent within a period", async () => {
    const response = await testHeatmap();
    const period = response.data?.availablePeriods[0];
    
    const [response1, response2] = await Promise.all([
        fetch(`${config.baseUrl}/grid/heatmap?period=${period}`),
        fetch(`${config.baseUrl}/grid/heatmap?period=${period}`)
    ]);

    const data1 = await response1.json();
    const data2 = await response2.json();

    expect(data1.cells).toEqual(data2.cells);
});

test("heatmap periods are chronologically ordered", async () => {
    const response = await testHeatmap();
    const periods = response.data?.availablePeriods;

    expect(periods).toBeDefined();
    
    const extractYear = (period: string) => parseInt(period.split('-')[0]);
    
    for (let i = 1; i < periods.length; i++) {
        const prevYear = extractYear(periods[i - 1]);
        const currentYear = extractYear(periods[i]);
        expect(currentYear).toBeGreaterThan(prevYear);
    }
});

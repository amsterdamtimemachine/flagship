import { expect, test } from "bun:test";
import type { GeoFeature, GridDimensions, BinaryCellIndex } from '@atm/shared-types';

const BASE_URL = 'http://localhost:3000';

async function testGridCell(cellId: string): Promise<{
    status: number;
    data?: {
        cellId: string;
        featureCount: number;
        features: GeoFeature[];
    };
    error?: string;
}> {
    const response = await fetch(`${BASE_URL}/grid/cell/${cellId}`);
    const data = await response.json();
    return {
        status: response.status,
        ...(response.ok ? { data } : { error: data.error })
    };
}

async function testMetadata(): Promise<{
    status: number;
    data?: {
        dimensions: GridDimensions;
        cellIndices: Record<string, BinaryCellIndex>;
    };
    error?: string;
}> {
    const response = await fetch(`${BASE_URL}/grid/metadata`);
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
    expect(dimensions.colsAmount).toBe(10);
    expect(dimensions.rowsAmount).toBe(10);
    expect(dimensions.minLon).toBeDefined();
    expect(dimensions.maxLon).toBeDefined();
    expect(dimensions.minLat).toBeDefined();
    expect(dimensions.maxLat).toBeDefined();
});

test("grid cell endpoint returns valid data for existing cell", async () => {
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


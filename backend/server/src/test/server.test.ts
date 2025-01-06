import { expect, test } from "bun:test";
import type { GeoFeature, GridDimensions, BinaryCellIndex } from '@atm/shared-types';
import type { HeatmapCell, HeatmapResponse } from "../processing";
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
    data?: {
        dimensions: GridDimensions;
        cellIndices: Record<string, BinaryCellIndex>;
    };
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

test("heatmap endpoint basic response", async () => {
    const response = await testHeatmap();
    expect(response.status).toBe(200);
    expect(response.data).toBeDefined();
    expect(response.data?.dimensions).toBeDefined();
    expect(response.data?.cells).toBeDefined();
});

test("heatmap cells array has correct structure", async () => {
    const response = await testHeatmap();
    const { dimensions, cells } = response.data!;

    // Check total number of cells
    const expectedCellCount = dimensions.rowsAmount * dimensions.colsAmount;
    expect(cells.length).toBe(expectedCellCount);

    // Check each cell's structure
    cells.forEach(cell => {
        expect(cell).toHaveProperty('cellId');
        expect(cell).toHaveProperty('row');
        expect(cell).toHaveProperty('col');
        expect(cell).toHaveProperty('featureCount');
        
        // Validate cell ID format matches row/col
        expect(cell.cellId).toBe(`${cell.row}_${cell.col}`);
        
        // Check bounds
        expect(cell.row).toBeGreaterThanOrEqual(0);
        expect(cell.row).toBeLessThan(dimensions.rowsAmount);
        expect(cell.col).toBeGreaterThanOrEqual(0);
        expect(cell.col).toBeLessThan(dimensions.colsAmount);
        
        // Feature count should be non-negative
        expect(cell.featureCount).toBeGreaterThanOrEqual(0);
    });
});

test("heatmap cells are ordered correctly", async () => {
    const response = await testHeatmap();
    const { cells } = response.data!;

    // Check cells are ordered by row then column
    for (let i = 1; i < cells.length; i++) {
        const prevCell = cells[i - 1];
        const currentCell = cells[i];

        if (prevCell.row === currentCell.row) {
            expect(currentCell.col).toBe(prevCell.col + 1);
        } else {
            expect(currentCell.row).toBe(prevCell.row + 1);
            expect(currentCell.col).toBe(0);
        }
    }
});

test("heatmap includes empty and non-empty cells", async () => {
    const response = await testHeatmap();
    const { cells } = response.data!;

    const emptyCells = cells.filter(cell => cell.featureCount === 0);
    const nonEmptyCells = cells.filter(cell => cell.featureCount > 0);

    // Should have both empty and non-empty cells in a typical grid
    expect(emptyCells.length).toBeGreaterThan(0);
    expect(nonEmptyCells.length).toBeGreaterThan(0);
});

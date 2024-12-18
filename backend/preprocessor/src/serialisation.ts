import { writeFile } from 'fs/promises';
import { GeoFeature, Grid } from '@atm/shared-types';

interface BinaryHeader {
    featuresOffset: number;     
    gridDataOffset: number;      
    //version: number;      
    // checksum?: string;
}

export async function serializeToBinary(
    features: GeoFeature[], 
    gridData: Grid, 
    outputPath: string
): Promise<void> {
    try {
        if (!Array.isArray(features) || features.length === 0) {
            throw new Error('Features array is empty or invalid');
        }
        if (!gridData?.cellCounts || !gridData?.entityGridIndices) {
            throw new Error('Grid data is missing required properties');
        }

        const headerSize = 64;
        const featuresBuffer = Buffer.from(JSON.stringify(features));

        const header: BinaryHeader = {
            featuresOffset: headerSize,
            gridDataOffset: headerSize + featuresBuffer.length,
        };

        const headerBuffer = Buffer.from(JSON.stringify(header));
        if (headerBuffer.length > headerSize) {
            throw new Error(`Header size (${headerBuffer.length}) exceeds fixed size (${headerSize})`);
        }

        const gridBuffer = Buffer.from(JSON.stringify({
            cellCounts: Array.from(gridData.cellCounts.entries()),
            entityGridIndices: Array.from(gridData.entityGridIndices.entries()),
            dimensions: gridData.dimensions
        }));

        const finalBuffer = Buffer.concat([
            headerBuffer,
            featuresBuffer,
            gridBuffer
        ]);

        await writeFile(outputPath, finalBuffer);
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to serialize data: ${error.message}`);
        }
        throw new Error('Failed to serialize data: Unknown error');
    }
}

import { decode } from '@msgpack/msgpack';
import type { GridDimensions, GeoFeature, BinaryMetadata } from '@atm/shared-types';

const BINARY_PATH = '/atm/public/geodata.bin';


async function loadBinaryWithCells(binaryPath: string) {
    try {
        const mmap = Bun.mmap(binaryPath);
        const buffer = mmap.buffer;
        const dataView = new DataView(buffer);

        const metadataSize = dataView.getUint32(0, false); // Important: Big-endian

        if (4 + metadataSize > buffer.byteLength) {
            console.error("Metadata size exceeds buffer length.");
            return null;
        }

        const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
        const metadata: BinaryMetadata = decode(metadataBytes) as BinaryMetadata;

        console.log("Metadata loaded");

        const cellDataStartOffset = 4 + metadataSize;
        const cellData: Record<string, GeoFeature[]> = {};

        for (const cellId in metadata.cellIndices) {
            const cellIndex = metadata.cellIndices[cellId];
            const cellDataStart = cellDataStartOffset + cellIndex.startOffset;
            const cellDataEnd = cellDataStartOffset + cellIndex.endOffset;
            const featureByteLength = cellIndex.endOffset - cellIndex.startOffset

            if (cellDataStart > buffer.byteLength || cellDataEnd > buffer.byteLength || cellDataEnd < cellDataStart) {
                console.error(`Cell data for ${cellId} is out of range. Start: ${cellDataStart}, End: ${cellDataEnd}, Buffer Length: ${buffer.byteLength}`);
                continue; // Skip to the next cell
            }

            const featureBytes = new Uint8Array(buffer, cellDataStart, featureByteLength);

            try {
                const featuresInCell: GeoFeature[] = decode(featureBytes) as GeoFeature[];
                cellData[cellId] = featuresInCell;
                if (featuresInCell.length !== cellIndex.featureCount) {
                    console.warn(`Feature count mismatch for cell ${cellId}. Metadata says ${cellIndex.featureCount}, but decoded ${featuresInCell.length}`);
                }
            } catch (decodeError) {
                console.error(`Error decoding features for cell ${cellId}:`, decodeError, featureBytes);
                return null; // Or handle the error differently
            }
        }

        console.log("Cell data loaded:", Object.keys(cellData).length, "cells");
        return cellData;
    } catch (error) {
        console.error("Error loading binary data:", error);
        return null;
    }
}


async function main() {
    await loadBinaryWithCells(BINARY_PATH);
}

main();

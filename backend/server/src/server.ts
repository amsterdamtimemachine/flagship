import { decode } from '@msgpack/msgpack';
import type { GridDimensions, GeoFeature } from '@atm/shared-types';

const BINARY_PATH = '/atm/public/new_grid.bin';

interface BinaryMetadata {
    version: number;
    dimensions: GridDimensions;
    cellIndices: Record<string, BinaryCellIndex>;
}

interface BinaryCellIndex {
    startOffset: number;
    endOffset: number;
    featureCount: number;
}

type Metadata = {
    version: number;
    dimensions: GridDimensions;
    cellIndices: Record<string, { startOffset: number; endOffset: number; featureCount: number }>;
};

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
        const metadata: Metadata = decode(metadataBytes) as Metadata;

        //console.log("Metadata:", metadata);

        const cellDataStartOffset = 4 + metadataSize;
        const cellData: Record<string, Feature[]> = {};

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
                const featuresInCell: Feature[] = decode(featureBytes) as Feature[];
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
type SimpleMetadata = {
    version: number;
    dimensions: GridDimensions;
    featureOffsets: { start: number; end: number }[];
};

interface Feature {
    type: string;
    properties: {
        url: string;
        title: string;
        start_date: string;
        end_date: string;
        thumb: string;
    };
    geometry: {
        type: string;
        coordinates: number[][][] | number[][];
        centroid?: { x: number; y: number };
    };
}
async function loadMinimalBinary(binaryPath: string) {
    try {
        const mmap = Bun.mmap(binaryPath);
        const buffer = mmap.buffer;
        const dataView = new DataView(buffer);

        const metadataSize = dataView.getUint32(0, false);

        if (4 + metadataSize > buffer.byteLength) {
            console.error(`Metadata size exceeds buffer length. Metadata Size: ${metadataSize}, Buffer Length: ${buffer.byteLength}`);
            return null;
        }

        const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
        const metadata: SimpleMetadata = decode(metadataBytes) as SimpleMetadata;

        //console.log("Metadata:", metadata);

        const features: Feature[] = [];
        const dataStart = 4 + metadataSize;

        for (const offset of metadata.featureOffsets) {
            const featureDataStart = dataStart + offset.start;
            const featureByteLength = offset.end - offset.start;

            if (featureDataStart >= buffer.byteLength || featureDataStart + featureByteLength > buffer.byteLength) {
                console.error("Error: Feature data out of range.");
                return null;
            }

            const featureBytes = new Uint8Array(buffer, featureDataStart, featureByteLength);
            
            try {
                const feature: Feature = decode(featureBytes) as Feature;
                features.push(feature);
            } catch (decodeError) {
                console.error("Error decoding feature:", decodeError, featureBytes);
                return null;
            }
        }

        console.log("Features loaded:", features.length);
        return features;
    } catch (error) {
        console.error("Error loading simplified binary:", error);
        return null;
    }
}

async function main() {
    await loadBinaryWithCells('/atm/public/min_bin.bin');
    //await loadMinimalBinary('/atm/public/min_bin.bin');
}

main();

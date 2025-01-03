import { decode } from '@msgpack/msgpack';

interface TestFeature {
    value: string;
}

interface BinaryCellIndex {
    startOffset: number;
    endOffset: number;
    featureCount: number;
}

interface BinaryMetadata {
    version: number;
    dimensions: [number, number];
    cellIndices: Record<string, BinaryCellIndex>;
}

async function readTestFile(path: string) {
    try {
        const mmap = Bun.mmap(path);
        const buffer = mmap.buffer;
        const dataView = new DataView(buffer);

        const metadataSize = dataView.getUint32(0, false); // Big-Endian

        if (4 + metadataSize > buffer.byteLength) {
            console.error(`Metadata size exceeds buffer length. Metadata Size: ${metadataSize}, Buffer Length: ${buffer.byteLength}`);
            return;
        }

        const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
        const metadata: BinaryMetadata = decode(metadataBytes) as BinaryMetadata;

        console.log("Metadata:", metadata);

        for (const cellId in metadata.cellIndices) {
            const cellIndex = metadata.cellIndices[cellId];
            const cellDataStart = 4 + metadataSize + cellIndex.startOffset;
            const cellDataEnd = 4 + metadataSize + cellIndex.endOffset;

            if (cellDataStart > buffer.byteLength || cellDataEnd > buffer.byteLength || cellDataEnd < cellDataStart) {
                console.error(`Cell data for ${cellId} is out of range.`);
                console.error(`Start: ${cellDataStart}, End: ${cellDataEnd}, Buffer Length: ${buffer.byteLength}`);
                return;
            }
            const featureByteLength = cellIndex.endOffset - cellIndex.startOffset
            const featureBytes = new Uint8Array(buffer, cellDataStart, featureByteLength);
            console.log("featureByteLength", featureByteLength);
            console.log("featureBytes", featureBytes)
            try {
                const features: TestFeature[] = decode(featureBytes) as TestFeature[];
                console.log(`Cell ${cellId}: ${features.length} features`);
                console.log("Features:", features);
            } catch (decodeError) {
                console.error(`Error decoding features for cell ${cellId}:`, decodeError);
                console.log("featureBytes", featureBytes)
                return;
            }
        }

    } catch (error) {
        console.error("Error reading file:", error);
    }
}

async function main() {
    await readTestFile("/atm/public/test.bin");
}

main();

// src/serialization/visualization.ts - Binary serialization for visualization data

import { encode } from '@msgpack/msgpack';
import type { RecordType, GridDimensions } from '../types/geo';
import type { HeatmapStack, HeatmapBlueprint } from '../processing';

export interface VisualizationMetadata {
  version: string;
  timestamp: string;
  gridDimensions: GridDimensions;
  heatmapBlueprint: HeatmapBlueprint;
  timeRange: {
    start: string;
    end: string;
  };
  recordtypes: RecordType[];
  tags: string[];
  sections: {
    heatmaps: {
      offset: number;
      length: number;
    };
    histograms?: {
      offset: number;
      length: number;
    };
  };
}

export interface HeatmapsData {
  [timePeriod: string]: HeatmapStack;
}

export class VisualizationBinaryWriter {
  private writer: any;
  private currentOffset: number = 0;
  private sections: VisualizationMetadata['sections'] = { heatmaps: { offset: 0, length: 0 } };

  constructor(private binaryPath: string) {}

  /**
   * Initialize the binary file and reserve space for metadata
   */
  async initialize(): Promise<void> {
    this.writer = Bun.file(this.binaryPath).writer();
    
    // Reserve 4 bytes for metadata size (will be written at the end)
    const placeholderSize = Buffer.allocUnsafe(4);
    placeholderSize.writeUInt32BE(0, 0);
    this.writer.write(placeholderSize);
    this.currentOffset += 4;
    
    // Reserve space for metadata (we'll calculate actual size later)
    // For now, just track that we'll write metadata here
    console.log(`📝 Initialized visualization binary writer for ${this.binaryPath}`);
  }

  /**
   * Write heatmaps data to the binary file
   */
  async writeHeatmaps(heatmapsData: HeatmapsData): Promise<void> {
    console.log(`🔥 Writing heatmaps data...`);
    
    // Store the absolute offset (including reserved metadata space)
    const heatmapsStartOffset = this.currentOffset;
    
    // Encode heatmaps data
    const encodedHeatmaps = encode(heatmapsData);
    
    // Write to file
    this.writer.write(encodedHeatmaps);
    
    // Store relative offset (from start of data sections, not including metadata)
    this.sections.heatmaps = {
      offset: 0, // First data section, so offset is 0 relative to data start
      length: encodedHeatmaps.byteLength
    };
    
    this.currentOffset += encodedHeatmaps.byteLength;
    
    console.log(`✅ Heatmaps written: ${encodedHeatmaps.byteLength} bytes at offset ${heatmapsStartOffset}`);
  }

  /**
   * Write histograms data to the binary file (placeholder for future implementation)
   */
  async writeHistograms(histogramsData: any): Promise<void> {
    console.log(`📊 Writing histograms data...`);
    
    // Calculate relative offset from start of data sections
    const currentDataOffset = this.currentOffset - 4; // Subtract metadata space reservation
    
    // Encode histograms data
    const encodedHistograms = encode(histogramsData);
    
    // Write to file
    this.writer.write(encodedHistograms);
    
    // Store relative offset (histograms come after heatmaps)
    this.sections.histograms = {
      offset: this.sections.heatmaps.length, // Offset relative to data start
      length: encodedHistograms.byteLength
    };
    
    this.currentOffset += encodedHistograms.byteLength;
    
    console.log(`✅ Histograms written: ${encodedHistograms.byteLength} bytes`);
  }

  /**
   * Finalize the binary file by writing metadata at the beginning
   */
  async finalize(
    gridDimensions: GridDimensions,
    heatmapBlueprint: HeatmapBlueprint,
    timeRange: { start: string; end: string },
    recordtypes: RecordType[],
    tags: string[]
  ): Promise<void> {
    console.log(`📋 Finalizing visualization binary...`);
    
    // Create metadata
    const metadata: VisualizationMetadata = {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      gridDimensions,
      heatmapBlueprint,
      timeRange,
      recordtypes,
      tags,
      sections: this.sections
    };
    
    // Encode metadata
    const encodedMetadata = encode(metadata);
    const metadataSize = encodedMetadata.byteLength;
    
    // Close current writer
    await this.writer.end();
    
    // Reopen file to write metadata at the beginning
    const file = Bun.file(this.binaryPath);
    const existingData = await file.arrayBuffer();
    
    // Create new file with metadata at the beginning
    const newWriter = Bun.file(this.binaryPath).writer();
    
    // Write metadata size
    const sizeBuffer = Buffer.allocUnsafe(4);
    sizeBuffer.writeUInt32BE(metadataSize, 0);
    newWriter.write(sizeBuffer);
    
    // Write metadata
    newWriter.write(encodedMetadata);
    
    // Write the rest of the data (skip the placeholder size bytes)
    const restOfData = new Uint8Array(existingData, 4);
    newWriter.write(restOfData);
    
    await newWriter.end();
    
    console.log(`✅ Visualization binary finalized:`);
    console.log(`   - Metadata: ${metadataSize} bytes`);
    console.log(`   - Heatmaps: ${this.sections.heatmaps.length} bytes`);
    if (this.sections.histograms) {
      console.log(`   - Histograms: ${this.sections.histograms.length} bytes`);
    }
    console.log(`   - Total size: ${4 + metadataSize + this.currentOffset - 4} bytes`);
  }
}

/**
 * Utility function to merge multiple heatmap accumulators (for future use)
 */
export function mergeHeatmapStacks(stacks: HeatmapStack[]): HeatmapStack {
  if (stacks.length === 0) {
    throw new Error('Cannot merge empty array of heatmap stacks');
  }
  
  if (stacks.length === 1) {
    return stacks[0];
  }
  
  // For now, return the first stack
  // TODO: Implement proper merging logic when needed
  console.warn('⚠️ HeatmapStack merging not yet implemented, returning first stack');
  return stacks[0];
}

/**
 * Helper function to create complete visualization binary from heatmaps
 */
export async function createVisualizationBinary(
  binaryPath: string,
  heatmapsData: HeatmapsData,
  gridDimensions: GridDimensions,
  heatmapBlueprint: HeatmapBlueprint,
  timeRange: { start: string; end: string },
  recordtypes: RecordType[],
  tags: string[]
): Promise<void> {
  const writer = new VisualizationBinaryWriter(binaryPath);
  
  try {
    await writer.initialize();
    await writer.writeHeatmaps(heatmapsData);
    await writer.finalize(
      gridDimensions,
      heatmapBlueprint,
      timeRange,
      recordtypes,
      tags
    );
    
    console.log(`🎉 Successfully created visualization binary: ${binaryPath}`);
  } catch (error) {
    console.error(`❌ Failed to create visualization binary:`, error);
    throw error;
  }
}

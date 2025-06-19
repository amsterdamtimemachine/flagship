// src/serialization/visualization.ts - Binary serialization for visualization data

import { encode, decode } from '@msgpack/msgpack';
import type {
  VisualizationMetadata,
  VisualizationData,
  HeatmapTimeline, 
  HeatmapBlueprint, 
  HistogramStack, 
  TimeSlice 
} from '@atm/shared/types';

export class VisualizationBinaryWriter {
  private writer: any;
  private currentOffset: number = 0;
  private sections: VisualizationMetadata['sections'] = { 
    heatmaps: { offset: 0, length: 0 },
    histograms: { offset: 0, length: 0 }
  };

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
    
    console.log(`📝 Initialized visualization binary writer for ${this.binaryPath}`);
  }

  /**
   * Write heatmaps data to the binary file
   */
  async writeHeatmaps(heatmapTimeline: HeatmapStack): Promise<void> {
    console.log(`🔥 Writing heatmaps data...`);
    
    // Store the absolute offset (including reserved metadata space)
    const heatmapsStartOffset = this.currentOffset;
    
    // Encode heatmaps data
    const encodedHeatmaps = encode(heatmapTimeline);
    
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
   * Write histograms data to the binary file
   */
  async writeHistograms(histogramStack: HistogramStack): Promise<void> {
    console.log(`📊 Writing histograms data...`);
    
    // Store the absolute offset
    const histogramsStartOffset = this.currentOffset;
    
    // Encode histograms data
    const encodedHistograms = encode(histogramStack);
    
    // Write to file
    this.writer.write(encodedHistograms);
    
    // Store relative offset (histograms come after heatmaps)
    this.sections.histograms = {
      offset: this.sections.heatmaps.length, // Offset relative to data start (after heatmaps)
      length: encodedHistograms.byteLength
    };
    
    this.currentOffset += encodedHistograms.byteLength;
    
    console.log(`✅ Histograms written: ${encodedHistograms.byteLength} bytes at offset ${histogramsStartOffset}`);
  }

  /**
   * Finalize with enhanced metadata including TimeSlices
   */
  async finalize(
    heatmapDimensions: heatmapDimensions,
    heatmapBlueprint: HeatmapBlueprint,
    timeSlices: TimeSlice[],
    recordTypes: RecordType[],
    tags: string[],
    stats?: VisualizationMetadata['stats']
  ): Promise<void> {
    console.log(`📋 Finalizing visualization binary...`);
    
    // Calculate overall time range from TimeSlices
    const timeRange = timeSlices.length > 0 ? {
      start: timeSlices[0].timeRange.start,
      end: timeSlices[timeSlices.length - 1].timeRange.end
    } : { start: '', end: '' };
    
    // Create metadata
    const metadata: VisualizationMetadata = {
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      heatmapDimensions,
      heatmapBlueprint,
      timeSlices,
      timeRange,
      recordTypes,
      tags,
      sections: this.sections,
      stats
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
    console.log(`   - Version: ${metadata.version}`);
    console.log(`   - Metadata: ${metadataSize} bytes`);
    console.log(`   - TimeSlices: ${timeSlices.length}`);
    console.log(`   - Heatmaps: ${this.sections.heatmaps.length} bytes`);
    console.log(`   - Histograms: ${this.sections.histograms.length} bytes`);
    console.log(`   - Total size: ${4 + metadataSize + this.currentOffset - 4} bytes`);
    
    if (stats) {
      console.log(`   - Features: ${stats.totalFeatures} total across ${stats.timeSliceCount} time slices`);
    }
  }
}

/**
 * Create visualization binary with both heatmaps and histograms
 */
export async function createVisualizationBinary(
  binaryPath: string,
  heatmapTimeline: HeatmapStack,
  histogramStack: HistogramStack,
  heatmapDimensions: heatmapDimensions,
  heatmapBlueprint: HeatmapBlueprint,
  timeSlices: TimeSlice[],
  recordTypes: RecordType[],
  tags: string[],
  stats?: VisualizationMetadata['stats']
): Promise<void> {
  const writer = new VisualizationBinaryWriter(binaryPath);
  
  try {
    await writer.initialize();
    
    // Write both data types (both required)
    await writer.writeHeatmaps(heatmapTimeline);
    await writer.writeHistograms(histogramStack);
    
    await writer.finalize(
      heatmapDimensions,
      heatmapBlueprint,
      timeSlices,
      recordTypes,
      tags,
      stats
    );
    
    console.log(`🎉 Successfully created visualization binary: ${binaryPath}`);
  } catch (error) {
    console.error(`❌ Failed to create visualization binary:`, error);
    throw error;
  }
}

/**
 * Generate visualization statistics from existing interfaces
 */
export function generateVisualizationStats(
  heatmapTimeline: HeatmapStack,
  histogramStack: HistogramStack,
  timeSlices: TimeSlice[]
): VisualizationMetadata['stats'] {
  let totalFeatures = 0;
  const featuresPerrecordType: Record<recordType, number> = {
    text: 0,
    image: 0,
    event: 0
  };
  
  // Count features from heatmaps (spatial aggregation)
  for (const [timeSliceKey, timeSliceData] of Object.entries(heatmapTimeline)) {
    for (const [recordType, recordTypeData] of Object.entries(timeSliceData)) {
      const counts = Array.from(recordTypeData.base.countArray);
      const recordTypeTotal = counts.reduce((sum, count) => sum + count, 0);
      
      featuresPerrecordType[recordType as recordType] += recordTypeTotal;
      totalFeatures += recordTypeTotal;
    }
  }
  
  // Get grid cell count from first heatmap
  const firstTimeSlice = Object.values(heatmapTimeline)[0];
  const firstrecordType = Object.values(firstTimeSlice)[0];
  const gridCellCount = firstrecordType.base.countArray.length;
  
  return {
    totalFeatures,
    featuresPerrecordType,
    timeSliceCount: timeSlices.length,
    gridCellCount
  };
}

/**
 * Merge multiple heatmap stacks
 */
export function mergeHeatmapStacks(stacks: HeatmapStack[]): HeatmapStack {
  if (stacks.length === 0) {
    throw new Error('Cannot merge empty array of heatmap stacks');
  }
  
  if (stacks.length === 1) {
    return stacks[0];
  }
  
  // Merge all stacks into one
  const merged: HeatmapStack = {};
  
  for (const stack of stacks) {
    for (const [timeSliceKey, timeSliceData] of Object.entries(stack)) {
      if (!merged[timeSliceKey]) {
        merged[timeSliceKey] = timeSliceData;
      } else {
        // Merge recordTypes within the same time slice
        for (const [recordType, recordTypeData] of Object.entries(timeSliceData)) {
          if (!merged[timeSliceKey][recordType as recordType]) {
            merged[timeSliceKey][recordType as recordType] = recordTypeData;
          } else {
            console.warn(`⚠️ recordType ${recordType} in time slice ${timeSliceKey} exists in multiple stacks, using first occurrence`);
          }
        }
      }
    }
  }
  
  console.log(`✅ Merged ${stacks.length} heatmap stacks into ${Object.keys(merged).length} time slices`);
  return merged;
}

/**
 * Merge multiple histogram stacks
 */
export function mergeHistogramStacks(stacks: HistogramStack[]): HistogramStack {
  if (stacks.length === 0) {
    throw new Error('Cannot merge empty array of histogram stacks');
  }
  
  if (stacks.length === 1) {
    return stacks[0];
  }
  
  // Merge all stacks into one
  const merged: HistogramStack = {};
  
  for (const stack of stacks) {
    for (const [timeSliceKey, timeSliceData] of Object.entries(stack)) {
      if (!merged[timeSliceKey]) {
        merged[timeSliceKey] = timeSliceData;
      } else {
        // Merge recordTypes within the same time slice
        for (const [recordType, recordTypeData] of Object.entries(timeSliceData)) {
          if (!merged[timeSliceKey][recordType as recordType]) {
            merged[timeSliceKey][recordType as recordType] = recordTypeData;
          } else {
            console.warn(`⚠️ recordType ${recordType} in time slice ${timeSliceKey} exists in multiple stacks, using first occurrence`);
          }
        }
      }
    }
  }
  
  console.log(`✅ Merged ${stacks.length} histogram stacks into ${Object.keys(merged).length} time slices`);
  return merged;
}

/**
 * Convenience function to create visualization data from separate stacks
 */
export function createVisualizationData(
  heatmapTimelines: HeatmapStack[],
  histogramStacks: HistogramStack[]
): VisualizationData {
  const heatmaps = mergeHeatmapStacks(heatmapTimelines);
  const histograms = mergeHistogramStacks(histogramStacks);
  
  return {
    heatmaps,
    histograms
  };
}

/**
 * Binary reader class for loading visualization data
 */
export class VisualizationBinaryReader {
  constructor(private binaryPath: string) {}
  
  /**
   * Read metadata from binary file
   */
  async readMetadata(): Promise<VisualizationMetadata> {
    const file = Bun.file(this.binaryPath);
    const buffer = await file.arrayBuffer();
    
    // Read metadata size
    const dataView = new DataView(buffer);
    const metadataSize = dataView.getUint32(0, false);
    
    // Read and decode metadata
    const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
    const metadata = decode(metadataBytes) as VisualizationMetadata;
    
    return metadata;
  }
  
  /**
   * Read heatmaps data from binary file
   */
  async readHeatmaps(): Promise<HeatmapStack> {
    const metadata = await this.readMetadata();
    const file = Bun.file(this.binaryPath);
    const buffer = await file.arrayBuffer();
    
    const dataView = new DataView(buffer);
    const metadataSize = dataView.getUint32(0, false);
    const dataStartOffset = 4 + metadataSize;
    
    const heatmapsBytes = new Uint8Array(
      buffer,
      dataStartOffset + metadata.sections.heatmaps.offset,
      metadata.sections.heatmaps.length
    );
    
    return decode(heatmapsBytes) as HeatmapStack;
  }
  
  /**
   * Read histograms data from binary file
   */
  async readHistograms(): Promise<HistogramStack> {
    const metadata = await this.readMetadata();
    const file = Bun.file(this.binaryPath);
    const buffer = await file.arrayBuffer();
    
    const dataView = new DataView(buffer);
    const metadataSize = dataView.getUint32(0, false);
    const dataStartOffset = 4 + metadataSize;
    
    const histogramsBytes = new Uint8Array(
      buffer,
      dataStartOffset + metadata.sections.histograms.offset,
      metadata.sections.histograms.length
    );
    
    return decode(histogramsBytes) as HistogramStack;
  }
  
  /**
   * Read complete visualization data from binary file
   */
  async readComplete(): Promise<VisualizationData & { metadata: VisualizationMetadata }> {
    const metadata = await this.readMetadata();
    const heatmaps = await this.readHeatmaps();
    const histograms = await this.readHistograms();
    
    return {
      heatmaps,
      histograms,
      metadata
    };
  }
}

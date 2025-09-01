// src/lib/server/binary-handler.ts
import { decode } from '@msgpack/msgpack';
import type { VisualizationMetadata, HeatmapResolutions, Histograms } from '@atm/shared/types';

export class VisualizationBinaryHandler {
	private binaryBuffer: ArrayBufferLike | null = null;
	private metadata: VisualizationMetadata | null = null;
	private dataStartOffset: number = 0;

	constructor(private binaryPath: string) {}

	async initialize(): Promise<void> {
		try {
			if (!this.binaryBuffer) {
				console.log('🔥 Opening binary file with memory mapping...');

				// Check if we're in Bun or Node.js environment
				let buffer: ArrayBufferLike;
				if (typeof Bun !== 'undefined') {
					// Bun environment - use memory mapping
					const mmap = Bun.mmap(this.binaryPath);
					buffer = mmap.buffer as ArrayBufferLike;
				} else {
					// Node.js environment - fallback to fs.readFile
					const fs = await import('fs/promises');
					const fileBuffer = await fs.readFile(this.binaryPath);
					buffer = fileBuffer.buffer.slice(
						fileBuffer.byteOffset,
						fileBuffer.byteOffset + fileBuffer.byteLength
					);
				}

				this.binaryBuffer = buffer;

				console.log(`📊 Buffer size: ${buffer.byteLength} bytes`);

				if (buffer.byteLength < 4) {
					throw new Error('Binary file too small - missing metadata size');
				}

				// Read metadata size
				const dataView = new DataView(buffer);
				const metadataSize = dataView.getUint32(0, false);
				console.log(`📋 Metadata size: ${metadataSize} bytes`);

				if (buffer.byteLength < 4 + metadataSize) {
					throw new Error(
						`Binary file truncated. Expected ${4 + metadataSize} bytes, got ${buffer.byteLength}`
					);
				}

				// Decode metadata
				try {
					const metadataBytes = new Uint8Array(buffer, 4, metadataSize);
					const metadata = decode(metadataBytes) as VisualizationMetadata;

					this.metadata = metadata;
					this.dataStartOffset = 4 + metadataSize;

					console.log('✅ Successfully decoded metadata');
					console.log(`📊 Version: ${metadata.version}`);
					console.log(`🕒 TimeSlices: ${metadata.timeSlices.length}`);
					console.log(`📈 RecordTypes: ${metadata.recordTypes.join(', ')}`);
					console.log(`🏷️ Tags: ${metadata.tags.length}`);
					console.log(`📐 Resolutions: ${metadata.resolutions.length}`);
				} catch (error) {
					console.error('❌ Failed to decode metadata:', error);
					throw error;
				}
			}
		} catch (error) {
			console.error('❌ Failed to initialize binary data:', error);
			throw error;
		}
	}

	getMetadata(): VisualizationMetadata {
		if (!this.metadata) {
			throw new Error('Metadata not initialized');
		}
		return this.metadata;
	}

	async readHeatmaps(): Promise<HeatmapResolutions> {
		if (!this.binaryBuffer || !this.metadata) {
			throw new Error('Binary handler not initialized');
		}

		const heatmapsSection = this.metadata.sections.heatmaps;
		const heatmapsBytes = new Uint8Array(
			this.binaryBuffer,
			this.dataStartOffset + heatmapsSection.offset,
			heatmapsSection.length
		);

		return decode(heatmapsBytes) as HeatmapResolutions;
	}

	async readHistograms(): Promise<Histograms> {
		if (!this.binaryBuffer || !this.metadata) {
			throw new Error('Binary handler not initialized');
		}

		const histogramsSection = this.metadata.sections.histograms;
		const histogramsBytes = new Uint8Array(
			this.binaryBuffer,
			this.dataStartOffset + histogramsSection.offset,
			histogramsSection.length
		);

		return decode(histogramsBytes) as Histograms;
	}

	/**
	 * Convert TypedArrays to regular arrays for JSON serialization
	 */
	private convertTypedArraysForSerialization(data: any): any {
		if (data && typeof data === 'object') {
			if (
				data.constructor &&
				data.constructor.name.includes('Array') &&
				data.constructor !== Array
			) {
				return Array.from(data);
			}

			if (Array.isArray(data)) {
				return data.map((item) => this.convertTypedArraysForSerialization(item));
			}

			const result: any = {};
			for (const [key, value] of Object.entries(data)) {
				result[key] = this.convertTypedArraysForSerialization(value);
			}
			return result;
		}

		return data;
	}

	/**
	 * Prepare data for JSON response by converting TypedArrays
	 */
	prepareForJsonResponse(data: any): any {
		return this.convertTypedArraysForSerialization(data);
	}
}

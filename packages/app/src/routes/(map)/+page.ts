// (map)/+page.ts - Load metadata, histogram, and heatmap timeline from new API with error accumulation
import type { PageLoad } from './$types';
import type {
	VisualizationMetadata,
	HistogramApiResponse,
	HeatmapTimelineApiResponse,
	RecordType
} from '@atm/shared/types';
import type { AppError } from '$types/error';
import { createPageErrorData, createError, createValidationError } from '$utils/error';
import { loadingState } from '$lib/state/loadingState.svelte';

interface MetadataApiResponse extends VisualizationMetadata {
	success: boolean;
	message?: string;
}

export const load: PageLoad = async ({ fetch, url }) => {
	loadingState.startLoading();

	const errors: AppError[] = [];
	let metadata: VisualizationMetadata | null = null;
	let histogram: HistogramApiResponse | null = null;
	let heatmapTimeline: HeatmapTimelineApiResponse | null = null;
	let availableTags: any = null;

	// Parse URL parameters
	const recordTypesParam = url.searchParams.get('recordTypes');
	const tagsParam = url.searchParams.get('tags');
	const tagOperatorParam = url.searchParams.get('tagOperator');

	try {
		const response = await fetch('/api/metadata');

		if (!response.ok) {
			errors.push(
				createError(
					'error',
					'API Request Failed',
					`Failed to fetch metadata: HTTP ${response.status}`,
					{ status: response.status, statusText: response.statusText }
				)
			);
		} else {
			const apiResponse = (await response.json()) as MetadataApiResponse;

			if (!apiResponse.success) {
				errors.push(
					createError(
						'error',
						'API Error',
						apiResponse.message || 'API returned unsuccessful response',
						{ response: apiResponse }
					)
				);
			} else {
				metadata = apiResponse;

				console.log('✅ Metadata loaded successfully:', {
					version: metadata.version,
					timestamp: metadata.timestamp,
					timeSlices: metadata.timeSlices.length,
					recordTypes: metadata.recordTypes,
					tags: metadata.tags.length,
					resolutions: metadata.resolutions.length,
					primaryGridDimensions: `${metadata.heatmapDimensions.colsAmount}x${metadata.heatmapDimensions.rowsAmount}`,
					allResolutionDimensions: Object.keys(metadata.resolutionDimensions || {}),
					timeRange: metadata.timeRange,
					totalFeatures: metadata.stats?.totalFeatures
				});

				// Debug: Check actual processing bounds
				// console.log('🗺️ Processing bounds:', {
				//   primaryResolution: {
				//     minLon: metadata.heatmapDimensions.minLon,
				//     maxLon: metadata.heatmapDimensions.maxLon,
				//     minLat: metadata.heatmapDimensions.minLat,
				//     maxLat: metadata.heatmapDimensions.maxLat,
				//     cellWidth: metadata.heatmapDimensions.cellWidth,
				//     cellHeight: metadata.heatmapDimensions.cellHeight
				//   }
				// });

				if (metadata.resolutionDimensions) {
					console.log('📐 Available resolutions:', metadata.resolutionDimensions);
				}
			}
		}
	} catch (err) {
		console.error('❌ Failed to load metadata:', err);

		errors.push(
			createError(
				'error',
				'Metadata Load Failed',
				'Could not load visualization metadata. Please ensure the server is running and the binary file is available.',
				{
					error: err instanceof Error ? err.message : 'Unknown error',
					timestamp: new Date().toISOString()
				}
			)
		);
	}

	// Determine recordTypes to use for API requests and UI state
	let currentRecordTypes: RecordType[] = [];

	if (metadata?.recordTypes) {
		// Handle recordTypes parameter
		if (recordTypesParam) {
			const requestedTypes = recordTypesParam.split(',').map((t) => t.trim()) as RecordType[];
			const validTypes = requestedTypes.filter((type) => metadata.recordTypes.includes(type));

			if (validTypes.length > 0) {
				currentRecordTypes = validTypes;
			} else {
				// If no valid record types are provided, add validation error but default to all types
				errors.push(
					createValidationError(
						'recordTypes',
						recordTypesParam,
						`Must contain at least one of: ${metadata.recordTypes.join(', ')}`
					)
				);
				// Default to all record types for better UX
				currentRecordTypes = metadata.recordTypes;
			}
		} else {
			// No recordTypes parameter - initialize with all available record types
			currentRecordTypes = metadata.recordTypes;
		}
	}

	// Parse tags if provided - need to validate combinations, not just existence
	let currentTags: string[] | undefined;

	// Parse tagOperator with default to OR (advanced search is AND)
	const currentTagOperator = tagOperatorParam === 'AND' ? 'AND' : 'OR';

	if (metadata?.tags && tagsParam) {
		const requestedTags = tagsParam.split(',').map((t) => t.trim()) as string[];

		// First filter: tags that exist in metadata
		const existingTags = requestedTags.filter((tag) => metadata.tags.includes(tag));
		const nonExistentTags = requestedTags.filter((tag) => !metadata.tags.includes(tag));

		// Add errors for non-existent tags
		for (const invalidTag of nonExistentTags) {
			errors.push(
				createError(
					'warning',
					'Invalid Tag Removed',
					`"${invalidTag}" is not a valid tag and was removed from your search.`,
					{ invalidTag, availableTags: metadata.tags }
				)
			);
		}

		// Second filter: validate tag combinations with current record types
		// We'll validate this after we have currentRecordTypes determined
		currentTags = existingTags; // For now, will validate combinations later
	}

	// Histogram promise
	const histogramPromise = (async () => {
		try {
			let histogramUrl = '/api/histogram';
			const histogramParams = new URLSearchParams();
			if (currentRecordTypes.length > 0) {
				histogramParams.set('recordTypes', currentRecordTypes.join(','));
			}
			if (currentTags && currentTags.length > 0) {
				histogramParams.set('tags', currentTags.join(','));
				histogramParams.set('tagOperator', currentTagOperator);
			}
			if (histogramParams.toString()) {
				histogramUrl += '?' + histogramParams.toString();
			}
			const histogramResponse = await fetch(histogramUrl);

			if (!histogramResponse.ok) {
				// Parse error message from SvelteKit error response
				let errorMessage = `HTTP ${histogramResponse.status}`;
				try {
					const errorData = await histogramResponse.json();
					if (errorData.message) {
						errorMessage = errorData.message;
					}
				} catch {
					// Fallback to status text if JSON parsing fails
					errorMessage = histogramResponse.statusText || errorMessage;
				}

				errors.push(
					createError('warning', 'Histogram Load Failed', errorMessage, {
						recordTypes: currentRecordTypes,
						tags: currentTags,
						status: histogramResponse.status
					})
				);
			} else {
				const histogramData = (await histogramResponse.json()) as HistogramApiResponse;
				histogram = histogramData;
			}
		} catch (err) {
			console.error('❌ Failed to load histogram:', err);

			errors.push(
				createError(
					'warning',
					'Histogram Load Error',
					'Could not load histogram data. The map will still function but temporal data may be limited.',
					{
						recordTypes: currentRecordTypes,
						tags: currentTags,
						error: err instanceof Error ? err.message : 'Unknown error'
					}
				)
			);
		}
	})();

	// Heatmap timeline promise
	const heatmapPromise = (async () => {
		try {
			let heatmapUrl = '/api/heatmaps';
			const heatmapParams = new URLSearchParams();
			if (currentRecordTypes.length > 0) {
				heatmapParams.set('recordTypes', currentRecordTypes.join(','));
			}
			if (currentTags && currentTags.length > 0) {
				heatmapParams.set('tags', currentTags.join(','));
				heatmapParams.set('tagOperator', currentTagOperator);
			}
			if (heatmapParams.toString()) {
				heatmapUrl += '?' + heatmapParams.toString();
			}
			const heatmapResponse = await fetch(heatmapUrl);

			if (!heatmapResponse.ok) {
				// Parse error message from SvelteKit error response
				let errorMessage = `HTTP ${heatmapResponse.status}`;
				try {
					const errorData = await heatmapResponse.json();
					if (errorData.message) {
						errorMessage = errorData.message;
					}
				} catch {
					// Fallback to status text if JSON parsing fails
					errorMessage = heatmapResponse.statusText || errorMessage;
				}

				errors.push(
					createError('warning', 'Heatmap Load Failed', errorMessage, {
						recordTypes: currentRecordTypes,
						tags: currentTags,
						status: heatmapResponse.status
					})
				);
			} else {
				const heatmapData = (await heatmapResponse.json()) as HeatmapTimelineApiResponse;
				heatmapTimeline = heatmapData;
			}
		} catch (err) {
			console.error('❌ Failed to load heatmap timeline:', err);

			errors.push(
				createError(
					'warning',
					'Heatmap Load Error',
					'Could not load heatmap timeline. Spatial visualization may be limited.',
					{
						recordTypes: currentRecordTypes,
						tags: currentTags,
						error: err instanceof Error ? err.message : 'Unknown error'
					}
				)
			);
		}
	})();

	// Available tags promise
	const availableTagsPromise = (async () => {
		try {
			const tagsUrl = `/api/available-tags${currentRecordTypes.length > 0 ? `?recordTypes=${currentRecordTypes.join(',')}` : ''}`;
			const tagsResponse = await fetch(tagsUrl);

			if (!tagsResponse.ok) {
				// Parse error message from SvelteKit error response
				let errorMessage = `HTTP ${tagsResponse.status}`;
				try {
					const errorData = await tagsResponse.json();
					if (errorData.message) {
						errorMessage = errorData.message;
					}
				} catch {
					// Fallback to status text if JSON parsing fails
					errorMessage = tagsResponse.statusText || errorMessage;
				}

				errors.push(
					createError('warning', 'Available Tags Load Failed', errorMessage, {
						recordTypes: currentRecordTypes,
						status: tagsResponse.status
					})
				);
			} else {
				const tagsData = await tagsResponse.json();
				availableTags = tagsData;
			}
		} catch (err) {
			console.error('❌ Failed to load available tags:', err);

			errors.push(
				createError(
					'warning',
					'Available Tags Load Error',
					'Could not load available tags. All tags will be shown in the interface.',
					{
						recordTypes: currentRecordTypes,
						error: err instanceof Error ? err.message : 'Unknown error'
					}
				)
			);
		}
	})();

	// Wait for all data requests to complete
	await Promise.all([histogramPromise, heatmapPromise, availableTagsPromise]);

	// Only validate tag combinations for AND operator (OR allows any combination)
	if (
		currentTagOperator === 'AND' &&
		currentTags &&
		currentTags.length > 0 &&
		currentRecordTypes &&
		metadata?.recordTypes
	) {
		try {
			// Use the "show all" exception: if no current record types, use all record types
			const effectiveRecordTypes =
				currentRecordTypes.length > 0 ? currentRecordTypes : metadata.recordTypes;

			// Send all tags to validate in a single API call
			const response = await fetch(
				`/api/tag-combinations?recordTypes=${effectiveRecordTypes.join(',')}&selected=${currentTags.join(',')}&validateAll=true`
			);

			if (response.ok) {
				const data = await response.json();

				// API should return validTags and invalidTags when validateAll=true
				const validCombinations = data.validTags || [];
				const invalidCombinations = data.invalidTags || [];

				// Update currentTags to only valid combinations
				currentTags = validCombinations.length > 0 ? validCombinations : undefined;

				console.log('INVALID COMBINATIONS:');
				console.log(invalidCombinations);

				// Add errors for invalid combinations
				for (const invalidTag of invalidCombinations) {
					errors.push(
						createError(
							'warning',
							'Invalid Tag Combination Removed',
							`"${invalidTag}" is not available with the current selection and was removed from your search.`,
							{ invalidTag, recordTypes: effectiveRecordTypes, validTags: validCombinations }
						)
					);
				}
			} else {
				console.error('Failed to validate tag combinations - API error:', response.status);
			}
		} catch (error) {
			console.error('Failed to validate tag combinations in route loader:', error);
			// On error, don't modify currentTags
		}
	}

	loadingState.stopLoading();
	return {
		metadata,
		histogram,
		heatmapTimeline,
		availableTags,
		currentRecordTypes,
		currentTags,
		currentTagOperator,
		errorData: createPageErrorData(errors)
	};
};

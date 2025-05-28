import { fetchApi } from '$api';
import { error } from '@sveltejs/kit';
import type { MetadataResponse, HeatmapsResponse, HistogramResponse, CellFeaturesResponse } from '@atm/shared-types';
import type { AppError } from '$types/error';
import type { PageLoad } from './$types';
import { createPageErrorData, createPeriodNotFoundError } from '$utils/error';
import {
	PUBLIC_SERVER_DEV_URL,
	PUBLIC_SERVER_PROD_URL,
	PUBLIC_DEFAULT_CONTENT_CLASS
} from '$env/static/public';

export const load: PageLoad = async ({ fetch, params, url }) => {
	console.log("reloading!");
	const baseUrl = import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;
	const { period, cellId } = params; // cellId is optional
	const errors: AppError[] = [];
	
	const contentClassesParam = url.searchParams.get('contentClasses') || PUBLIC_DEFAULT_CONTENT_CLASS;
	const tagsParam = url.searchParams.get('tags') || '';
	
	const metadataUrl = baseUrl + '/grid/metadata';
	const heatmapsUrl = `${baseUrl}/grid/heatmaps?contentClasses=${contentClassesParam}${tagsParam ? `&tags=${tagsParam}` : ''}`;
	const histogramUrl = `${baseUrl}/grid/histogram?contentClasses=${contentClassesParam}${tagsParam ? `&tags=${tagsParam}` : ''}`;
	
	let metadata, heatmaps, histogram;
	
	try {
		console.log("refetching meta data");
		[metadata, heatmaps, histogram] = await Promise.all([
			fetchApi<MetadataResponse>(metadataUrl, fetch),
			fetchApi<HeatmapsResponse>(heatmapsUrl, fetch),
			fetchApi<HistogramResponse>(histogramUrl, fetch)
		]);
	} catch (err) {
		console.error('Failed to load core page data:', err);
		error(500, {
			message: 'Failed to load page data. Please try again.',
			code: 'DATA_LOAD_FAILED'
		});
	}
	
	// Validate the period
	const availablePeriods = metadata?.timePeriods || [];
	const isValidPeriod = availablePeriods.includes(period);
	const initialPeriod = isValidPeriod ? period : availablePeriods[0];
	
	if (!isValidPeriod) {
		errors.push(createPeriodNotFoundError(period, availablePeriods, initialPeriod));
	}
	
	// Conditionally load cell data if cellId is provided
	let cellData = null;
	if (cellId) {
		try {
			// Build cell API URL with same parameters as original
			let cellApiUrl = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=1`;
			if (contentClassesParam) cellApiUrl += `&contentClasses=${contentClassesParam}`;
			if (tagsParam) cellApiUrl += `&tags=${tagsParam}`;
			
			const cellFeatures = await fetchApi<CellFeaturesResponse>(cellApiUrl, fetch);
			cellData = { cellFeatures };
		} catch (err) {
			console.error('Failed to load cell data:', err);
			errors.push({
				id: `cell_load_error_${Date.now()}`,
				type: 'error',
				title: 'Cell Data Load Failed',
				description: `Failed to load data for cell ${cellId}. Please try again.`,
				timestamp: new Date(),
				context: { cellId, period }
			});
		}
	}
	
	return { 
		metadata, 
		heatmaps, 
		histogram,
		initialPeriod,
		cellData, // null if no cellId or if loading failed
		errorData: createPageErrorData(errors)
	};
};

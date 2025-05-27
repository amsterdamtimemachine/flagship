import { fetchApi } from '$api';
import { error } from '@sveltejs/kit';
import type { MetadataResponse, HeatmapsResponse, HistogramResponse } from '@atm/shared-types';
import type { AppError } from '$types/error'
import type { PageLoad } from './$types';
import { createPageErrorData, createPeriodNotFoundError } from '$utils/error';
import {
	PUBLIC_SERVER_DEV_URL,
	PUBLIC_SERVER_PROD_URL,
	PUBLIC_DEFAULT_CONTENT_CLASS
} from '$env/static/public';

export const load: PageLoad = async ({ fetch, params, url }) => {
	const baseUrl = import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;
	const requestedPeriod = params.period;
	const errors : AppError[] = [];	
	
	// Get content classes and tags from URL search params
	const contentClassesParam = url.searchParams.get('contentClasses') || PUBLIC_DEFAULT_CONTENT_CLASS;
	const tagsParam = url.searchParams.get('tags') || '';
	
	const metadataUrl = baseUrl + '/grid/metadata';
	const heatmapsUrl = `${baseUrl}/grid/heatmaps?contentClasses=${contentClassesParam}${tagsParam ? `&tags=${tagsParam}` : ''}`;
	const histogramUrl = `${baseUrl}/grid/histogram?contentClasses=${contentClassesParam}${tagsParam ? `&tags=${tagsParam}` : ''}`;
	
	let metadata, heatmaps, histogram;
	
	try {
		[metadata, heatmaps, histogram] = await Promise.all([
			fetchApi<MetadataResponse>(metadataUrl, fetch),
			fetchApi<HeatmapsResponse>(heatmapsUrl, fetch),
			fetchApi<HistogramResponse>(histogramUrl, fetch)
		]);
	} catch (err) {
		console.error('Failed to load page data:', err);
		
		error(500, {
			message: 'Failed to load page data. Please try again.',
			code: 'DATA_LOAD_FAILED'
		});
	}
	
	// Validate the period 
	const availablePeriods = metadata?.timePeriods || [];
	const isValidPeriod = availablePeriods.includes(requestedPeriod);
	const initialPeriod = isValidPeriod ? requestedPeriod : availablePeriods[0];
	
	if (!isValidPeriod) {
		errors.push(createPeriodNotFoundError(requestedPeriod, availablePeriods, initialPeriod));
	}
	
	return { 
		metadata, 
		heatmaps, 
		histogram,
		initialPeriod,
		errorData: createPageErrorData(errors)
	};
};

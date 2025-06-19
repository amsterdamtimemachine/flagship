// (map)/+page.ts - Remove all cell-related logic
import { fetchApi } from '$api';
import { error } from '@sveltejs/kit';
import type { MetadataResponse, HeatmapTimelineResponse, HistogramResponse } from '@atm/shared/type';
import type { AppError } from '$types/error';
import type { PageLoad } from './$types';
import { createPageErrorData, createPeriodNotFoundError } from '$utils/error';
import {
	PUBLIC_SERVER_DEV_URL,
	PUBLIC_SERVER_PROD_URL,
	PUBLIC_DEFAULT_CONTENT_CLASS
} from '$env/static/public';

export const load: PageLoad = async ({ fetch, url }) => {
	const baseUrl = import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;
	const errors: AppError[] = [];
	
	const period = url.searchParams.get('period');
	const contentClassesParam = url.searchParams.get('contentClasses') || PUBLIC_DEFAULT_CONTENT_CLASS;
	const tagsParam = url.searchParams.get('tags') || '';
	
	let metadata, heatmaps, histogram;
	
	try {
		const metadataUrl = baseUrl + '/grid/metadata';
		const heatmapsUrl = `${baseUrl}/grid/heatmaps?contentClasses=${contentClassesParam}${tagsParam ? `&tags=${tagsParam}` : ''}`;
		const histogramUrl = `${baseUrl}/grid/histogram?contentClasses=${contentClassesParam}${tagsParam ? `&tags=${tagsParam}` : ''}`;
		
		[metadata, heatmaps, histogram] = await Promise.all([
			fetchApi<MetadataResponse>(metadataUrl, fetch),
			fetchApi<HeatmapTimelineResponse>(heatmapsUrl, fetch),
			fetchApi<HistogramResponse>(histogramUrl, fetch)
		]);
	} catch (err) {
		console.error('Failed to load static data:', err);
		error(500, {
			message: 'Failed to load page data. Please try again.',
			code: 'DATA_LOAD_FAILED'
		});
	}
	
	// Validate and set period
	const availablePeriods = metadata?.timePeriods || [];
	const isValidPeriod = period && availablePeriods.includes(period);
	const currentPeriod = isValidPeriod ? period : availablePeriods[0];
	
	// Add error if period was invalid
	if (period && !isValidPeriod) {
		errors.push(createPeriodNotFoundError(period, availablePeriods, currentPeriod));
	}
	
	return { 
		metadata, 
		heatmaps, 
		histogram,
		currentPeriod,
		errorData: createPageErrorData(errors)
	};
};

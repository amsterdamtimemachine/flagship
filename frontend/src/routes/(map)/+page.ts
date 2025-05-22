import { fetchApi } from '$api';
import type { MetadataResponse, HeatmapsResponse, HistogramResponse } from '@atm/shared-types';
import type { PageLoad } from './$types';
import {
	PUBLIC_SERVER_DEV_URL,
	PUBLIC_SERVER_PROD_URL,
	PUBLIC_DEFAULT_CONTENT_CLASS
} from '$env/static/public';

export const load: PageLoad = async ({ fetch }) => {
	const baseUrl =
		import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;
	
	const metadataUrl = baseUrl + '/grid/metadata';
	const heatmapsUrl = baseUrl + `/grid/heatmaps?contentClasses=${PUBLIC_DEFAULT_CONTENT_CLASS}`;
	const histogramUrl = baseUrl + `/grid/histogram?contentClasses=${PUBLIC_DEFAULT_CONTENT_CLASS}`;
	
	const [metadata, heatmaps, histogram] = await Promise.all([
		fetchApi<MetadataResponse>(metadataUrl, fetch),
		fetchApi<HeatmapsResponse>(heatmapsUrl, fetch),
		fetchApi<HistogramResponse>(histogramUrl, fetch)
	]);
	
	return { metadata, heatmaps, histogram };
};

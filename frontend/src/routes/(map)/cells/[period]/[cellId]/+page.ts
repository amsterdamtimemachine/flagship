import { fetchApi } from '$api';
import type { CellFeaturesResponse } from '@atm/shared-types';
import type { PageLoad } from './$types';
import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';

export const load: PageLoad = async ({ params, url, fetch }) => {
	const baseUrl =
		import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;
	const { period, cellId } = params;
	const page = 1;

	// Get content classes and tags from URL query parameters
	const contentClasses = url.searchParams.get('contentClasses') || '';
	const tags = url.searchParams.get('tags') || '';

	let apiUrl = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=${page}`;
	if (contentClasses) apiUrl += `&contentClasses=${contentClasses}`;
	if (tags) apiUrl += `&tags=${tags}`;

	const cellFeatures = await fetchApi<CellFeaturesResponse>(apiUrl, fetch);
	return { cellFeatures };
};

import { fetchApi } from '$api';
import type { CellFeaturesResponse } from '@atm/shared-types';
import type { PageLoad } from './$types';

import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';
export const load: PageLoad = async ({ params, fetch }) => {

  const baseUrl = import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;

	const cellFeaturesUrl = baseUrl + '/grid/cell/303_249?period=1968-2018&page=1'; 	
	const cellFeatures = await fetchApi<CellFeaturesResponse>(cellFeaturesUrl, fetch);
	console.log(cellFeatures);
	//const cellUrl = 'http://localhost:9000/api/cell/29_10?startDate=1800-01-01&endDate=1900-01-01'	
	//const cellData = await fetchApi<CellResponse>(cellUrl, fetch);

	return { cellFeatures };
};




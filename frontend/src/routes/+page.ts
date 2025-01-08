import { fetchApi, postApi } from '$api';
import type { Heatmap } from '@atm/shared-types';
import type { PageLoad } from './$types';

import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';
export const load: PageLoad = async ({ fetch }) => {

  const baseUrl = import.meta.env.MODE === 'production' ? PUBLIC_SERVER_DEV_URL : PUBLIC_SERVER_PROD_URL;

	const heatmapUrl = baseUrl + '/grid/heatmap' //?startDate=1800-01-01&endDate=1950-01-01'	
	const heatmap = await fetchApi<Heatmap>(heatmapUrl, fetch);
	//const cellUrl = 'http://localhost:9000/api/cell/29_10?startDate=1800-01-01&endDate=1900-01-01'	
	//const cellData = await fetchApi<CellResponse>(cellUrl, fetch);

	return { heatmap };
};

import { fetchApi, postApi } from '$api';
import type { HeatmapResponse, CellResponse } from '$types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {


	const heatmapUrl = 'http://localhost:9000/api/heatmap?startDate=1800-01-01&endDate=1970-12-31'	
	const heatmapData = await fetchApi<HeatmapResponse>(heatmapUrl, fetch);
	const cellUrl = 'http://localhost:9000/api/cell/10_10?startDate=1800-01-01&endDate=1805-01-01'	
	const cellData = await fetchApi<CellResponse>(cellUrl, fetch);
	console.log("CELL BRUH: ", cellData);

	return { heatmapData };
};

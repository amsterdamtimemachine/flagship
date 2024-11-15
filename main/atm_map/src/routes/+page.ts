import { fetchApi, postApi } from '$api';
import type { HeatmapResponse, CellResponse } from '$types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {


	const heatmapUrl = 'http://localhost:9000/api/heatmap?startDate=1800-01-01&endDate=1970-12-31'	
	const heatmapData = await fetchApi<HeatmapResponse>(heatmapUrl, fetch);
	console.log(heatmapData);

	const cellUrl = 'http://localhost:9000/api/cell/20_20'	
	const cellData = await fetchApi<CellResponse>(cellUrl, fetch);
	console.log("cell: ", cellData);

	return { heatmapData };
};

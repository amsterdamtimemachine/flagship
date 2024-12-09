import { fetchApi, postApi } from '$api';
import type { HeatmapResponse, CellResponse } from '$types';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {


	const heatmapUrl = 'http://localhost:9000/api/heatmap' //?startDate=1800-01-01&endDate=1950-01-01'	
	const heatmap = await fetchApi<HeatmapResponse>(heatmapUrl, fetch);
	//const cellUrl = 'http://localhost:9000/api/cell/29_10?startDate=1800-01-01&endDate=1900-01-01'	
	//const cellData = await fetchApi<CellResponse>(cellUrl, fetch);
	console.log("heatmap : ", heatmap);

	return { heatmap };
};

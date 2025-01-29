import { fetchApi } from '$api';
import type { CellFeaturesResponse } from '@atm/shared-types';
import type { PageLoad } from './$types';
import { PUBLIC_SERVER_DEV_URL, PUBLIC_SERVER_PROD_URL } from '$env/static/public';

export const load: PageLoad = async ({ params, fetch }) => {
  const baseUrl = import.meta.env.MODE === 'production' ? 
    PUBLIC_SERVER_DEV_URL : 
    PUBLIC_SERVER_PROD_URL;
    
  const { period, cellId } = params;
  const page = 1;
  
  const url = `${baseUrl}/grid/cell/${cellId}?period=${period}&page=${page}`;
  const cellFeatures = await fetchApi<CellFeaturesResponse>(url, fetch);
  
  return { cellFeatures };
};

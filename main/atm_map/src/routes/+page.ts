import { fetchApi, postApi } from '$api';
import type { PageLoad } from './$types';

interface ImageData {
 url: string;
 title: string;
 start_date: string;
 thumb: string;
 geom: string;
}

interface ImageResponse {
 [key: string]: ImageData;
}

export const load: PageLoad = async ({ fetch }) => {
 const response = await fetchApi<ImageResponse>('http://localhost:9000/api/images/20', fetch);
};



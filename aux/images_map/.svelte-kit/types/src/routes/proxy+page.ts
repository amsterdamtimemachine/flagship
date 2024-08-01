// @ts-nocheck
// src/routes/user/[id]/+page.ts
import { fetchApi } from '$api';
import { type ImageResponse } from '$types/image';
import type { PageLoad } from './$types';

export const load = async ({ fetch }: Parameters<PageLoad>[0]) => {
  return {
    images: await fetchApi<ImageResponse>(`https://api.lod.uba.uva.nl/queries/LeonvanWissen/SAA-Beeldbank/5/run?`, fetch)
  };
};

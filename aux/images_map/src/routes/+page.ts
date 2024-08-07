// src/routes/user/[id]/+page.ts
import { fetchApi } from '$api';
import { type ImageResponse } from '$types/image';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ fetch }) => {
  const q = `https://api.lod.uba.uva.nl/queries/LeonvanWissen/SAA-Beeldbank/7/run?bbox=POLYGON((4.8801613 52.3924682,4.8520088 52.3638604,4.9047089 52.3465611,4.9362946 52.3732936,4.8801613 52.3924682))&minYear=1600&maxYear=2000`;

  const images = await fetchApi<ImageResponse>(q, fetch);
  return { images };
};



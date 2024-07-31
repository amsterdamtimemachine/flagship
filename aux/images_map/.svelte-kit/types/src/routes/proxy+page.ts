// @ts-nocheck
// src/routes/user/[id]/+page.ts
import { fetchApi } from '$lib/api';
import type { PageLoad } from './$types';

interface UserData {
  id: number;
  name: string;
  email: string;
}

export const load = async ({ params, fetch }: Parameters<PageLoad>[0]) => {
  return {
    images: await fetchApi<any>(`https://api.lod.uba.uva.nl/queries/LeonvanWissen/SAA-Beeldbank/5/run?`, fetch)
  };
};

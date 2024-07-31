// src/routes/user/[id]/+page.ts
import { fetchApi } from '$lib/api';
import type { PageLoad } from './$types';

interface UserData {
  id: number;
  name: string;
  email: string;
}

export const load: PageLoad = async ({ params, fetch }) => {
  return {
    images: await fetchApi<any>(`https://api.lod.uba.uva.nl/queries/LeonvanWissen/SAA-Beeldbank/5/run?`, fetch)
  };
};

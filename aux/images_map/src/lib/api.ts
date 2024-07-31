// src/lib/api.ts

import { error } from '@sveltejs/kit';
import { loadingStore } from '$lib/stores/loadingStore';

type FetchFunction = typeof fetch;

export async function fetchApi<T>(
  endpoint: string,
  fetchFn: FetchFunction = fetch
): Promise<T> {
  loadingStore.startLoading();

  try {
    const response = await fetchFn(endpoint);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json() as T;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    error(500, { message: errorMessage, code: 'API_ERROR' });
  } finally {
    loadingStore.stopLoading();
  }
}

// src/lib/api.ts

import { error } from '@sveltejs/kit';
import { loadingStore } from '$lib/stores/loadingStore';

type FetchFunction = typeof fetch;

export async function fetchApi<T>(endpoint: string, fetchFn: FetchFunction = fetch): Promise<T> {
	loadingStore.startLoading();

	try {
		const response = await fetchFn(endpoint);

		if (!response.ok) {
			throw new Error(`HTTP error! status: ${response.status}`);
		}
		return (await response.json()) as T;
	} catch (err) {
		const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
		error(500, { message: errorMessage, code: 'API_ERROR' });
	} finally {
		loadingStore.stopLoading();
	}
}


export async function postApi<T>(
  endpoint: string,
  data?: any,
  options?: RequestInit
): Promise<T> {
  const defaultOptions: RequestInit = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: data ? JSON.stringify(data) : undefined,
  };

  const mergedOptions = { ...defaultOptions, ...options };

  try {
    const response = await fetch(endpoint, mergedOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json() as T;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
    throw new Error(`API Error: ${errorMessage}`);
  }
}

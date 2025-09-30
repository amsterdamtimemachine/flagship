// src/routes/api/geodata/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, fetch }) => {
	try {
		// Get all query parameters from the request
		const params = new URLSearchParams();
		url.searchParams.forEach((value, key) => {
			params.set(key, value);
		});

		// Build the external API URL
		const externalApiUrl = `https://atmbackend.create.humanities.uva.nl/api/geodata?${params.toString()}`;

		console.log('🌍 Proxying geodata request to:', externalApiUrl);

		// Make the request to the external API
		const response = await fetch(externalApiUrl);

		if (!response.ok) {
			console.error('External API error:', response.status, response.statusText);
			return json(
				{ error: 'Failed to fetch data from external API', status: response.status },
				{ status: response.status }
			);
		}

		const data = await response.json();

		// Return the data with CORS headers
		return json(data, {
			headers: {
				'Access-Control-Allow-Origin': '*',
				'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
				'Access-Control-Allow-Headers': 'Content-Type'
			}
		});
	} catch (error) {
		console.error('Proxy error:', error);
		return json(
			{
				error: 'Internal server error',
				message: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};

export const OPTIONS: RequestHandler = async () => {
	return new Response(null, {
		status: 200,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
};

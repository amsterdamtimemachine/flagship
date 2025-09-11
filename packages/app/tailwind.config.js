/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'custom-green': '#00ff00',
				'link': '#c99626',
				'link-hover': '#78481e',
				'atm-sand': '#fff8f4',
				'atm-sand-dark': '#e2d5cc',
				'map': {
					'cell-selected': '#ff4830',
					'cell-hovered': '#f28374', 
					'cell-value': '#005bff',
					'background': '#fbf5f2',
					'water-fill': '#e8f2fe',
					'water-outline': '#e3bb86'
				}
			},
			fontFamily: {
				'sans': ['Satoshi', 'sans-serif'],
				// Add your custom fonts here, e.g.:
				// 'custom': ['MyCustomFont', 'sans-serif'],
				// 'heading': ['MyHeadingFont', 'serif'],
			}
		}
	},
	plugins: []
};

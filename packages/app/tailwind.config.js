/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'custom-green': '#00ff00',
				'link': '#c99626',
				'link-hover': '#78481e',
				'atm-sand': '#fcf8f7',
				'atm-sand-dark': '#d9cdc5',
				'atm-sand-border': '#9b8779',
				'atm-red': '#ff4830',
				'atm-red-light': '#f28374',
				'atm-blue':'#5480f1',
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
			}
		}
	},
	plugins: []
};

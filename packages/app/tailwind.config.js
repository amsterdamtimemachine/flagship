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
				'atm-sand-darkish': '#f9f2f0',
				'atm-sand-dark': '#f6e8df',
				'atm-sand-border': '#d7c5b8',
				'atm-gold': '#dcb27d', 
				'atm-red': '#ff4830',
				'atm-red-light': '#f17562',
				'atm-blue':'#5480f1',
				'map': {
					'cell-value': '#0053fb',// '#0056f3', //'#005bff',
					'background': '#fbf5f2',
					'water-fill': '#ddecfe',
					'water-outline': '#a3c4e7'
				}
			},
			fontFamily: {
				'sans': ['Satoshi', 'sans-serif'],
			}
		}
	},
	plugins: []
};

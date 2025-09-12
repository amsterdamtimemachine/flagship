/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				'custom-green': '#00ff00',
				'link': '#6D5026',
				'link-hover': '#78481e',
				'atm-sand': '#fcf8f7',
				'atm-sand-darkish': '#f9f2f0',
				'atm-sand-dark': '#f6e8df',
				'atm-sand-darkest': '#af8e74', 
				'atm-sand-border': '#d7c5b8',
				'atm-gold': '#dcb27d', 
				'atm-gold-dark': '#cca36e', 
				'atm-gold-darkest': '#58401a',
				'atm-red': '#ee5e00',
				'atm-red-light': '#f17562',
				'atm-blue':'#5e92f3',
				'map': {
					'cell-value': '#0053fb',
					'background': '#efd9ca', //'dark sand #efd9ca', //' sand #fbf5f2', // '#bfd9c3' green
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

export const index = 1;
let component_cache;
export const component = async () =>
	(component_cache ??= (await import('../entries/fallbacks/error.svelte.js')).default);
export const imports = [
	'_app/immutable/nodes/1.BClRrFC6.js',
	'_app/immutable/chunks/scheduler.BvLojk_z.js',
	'_app/immutable/chunks/index.Bwsrhzvr.js',
	'_app/immutable/chunks/entry.U26xVH4E.js',
	'_app/immutable/chunks/control.DPVIsdIO.js'
];
export const stylesheets = [];
export const fonts = [];

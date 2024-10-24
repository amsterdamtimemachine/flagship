export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set(["favicon.png"]),
	mimeTypes: {".png":"image/png"},
	_: {
		client: {"start":"_app/immutable/entry/start.Bba_9EAD.js","app":"_app/immutable/entry/app.Be_USFu3.js","imports":["_app/immutable/entry/start.Bba_9EAD.js","_app/immutable/chunks/entry.D8TRZSKW.js","_app/immutable/chunks/scheduler.BvLojk_z.js","_app/immutable/chunks/control.DPVIsdIO.js","_app/immutable/entry/app.Be_USFu3.js","_app/immutable/chunks/scheduler.BvLojk_z.js","_app/immutable/chunks/index.DOpj1qAO.js"],"stylesheets":[],"fonts":[],"uses_env_dynamic_public":false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js'))
		],
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			}
		],
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

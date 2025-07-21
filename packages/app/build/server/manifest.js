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
		client: {start:"_app/immutable/entry/start.7MHBBKDf.js",app:"_app/immutable/entry/app.D-lXkhLY.js",imports:["_app/immutable/entry/start.7MHBBKDf.js","_app/immutable/chunks/CVoPYFcs.js","_app/immutable/chunks/C3Oq8ujz.js","_app/immutable/entry/app.D-lXkhLY.js","_app/immutable/chunks/C3Oq8ujz.js","_app/immutable/chunks/DbU8AASQ.js","_app/immutable/chunks/D-oH6gaZ.js","_app/immutable/chunks/BRNGIgBz.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js'))
		],
		routes: [
			{
				id: "/(map)",
				pattern: /^\/?$/,
				params: [],
				page: { layouts: [0,,], errors: [1,2,], leaf: 3 },
				endpoint: null
			},
			{
				id: "/api/geodata",
				pattern: /^\/api\/geodata\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/geodata/_server.ts.js'))
			},
			{
				id: "/api/heatmaps",
				pattern: /^\/api\/heatmaps\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/heatmaps/_server.ts.js'))
			},
			{
				id: "/api/histogram",
				pattern: /^\/api\/histogram\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/histogram/_server.ts.js'))
			},
			{
				id: "/api/metadata",
				pattern: /^\/api\/metadata\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/metadata/_server.ts.js'))
			},
			{
				id: "/api/test",
				pattern: /^\/api\/test\/?$/,
				params: [],
				page: null,
				endpoint: __memo(() => import('./entries/endpoints/api/test/_server.ts.js'))
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();

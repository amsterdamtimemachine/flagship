import { H as P, w as R } from '../chunks/control.DPVIsdIO.js';
import { s as S, n as y, r as j, o as O } from '../chunks/scheduler.BvLojk_z.js';
import {
	S as N,
	i as z,
	e as h,
	s as v,
	c as T,
	d as C,
	y as L,
	h as W,
	g as _,
	j as b,
	k as p,
	z as M,
	b as k,
	f as w,
	l as A
} from '../chunks/index.Bwsrhzvr.js';
function I(n, e) {
	throw new P(n, e);
}
new TextEncoder();
function U() {
	const { subscribe: n, update: e } = R(!1);
	let t = 0;
	return {
		subscribe: n,
		startLoading: () => {
			e(() => (t++, !0));
		},
		stopLoading: () => {
			e(() => ((t = Math.max(0, t - 1)), t > 0));
		},
		reset: () => {
			e(() => ((t = 0), !1));
		}
	};
}
const x = U();
async function q(n, e = fetch) {
	x.startLoading();
	try {
		const t = await e(n);
		if (!t.ok) throw new Error(`HTTP error! status: ${t.status}`);
		return await t.json();
	} catch (t) {
		const a = t instanceof Error ? t.message : 'An unknown error occurred';
		I(500, { message: a, code: 'API_ERROR' });
	} finally {
		x.stopLoading();
	}
}
const B = async ({ fetch: n }) => ({
		images: await q('https://api.lod.uba.uva.nl/queries/LeonvanWissen/SAA-Beeldbank/5/run?', n)
	}),
	Q = Object.freeze(
		Object.defineProperty({ __proto__: null, load: B }, Symbol.toStringTag, { value: 'Module' })
	);
function E(n) {
	return n['@graph'].flatMap((e) => {
		const t = Array.isArray(e.image) ? e.image : [e.image],
			a = Array.isArray(e.contentLocation) ? e.contentLocation : [e.contentLocation];
		return t.map((u, l) => {
			var m;
			let i = null;
			const c = a[l];
			if (c && (m = c['geo:hasGeometry']) != null && m[0]) {
				const r = c['geo:hasGeometry'][0]['geo:asWKT']['@value'].match(
					/POINT\((-?\d+\.?\d*)\s+(-?\d+\.?\d*)\)/
				);
				r && (i = { x: Number(r[1]), y: Number(r[2]) });
			}
			return { url: u.thumbnailUrl, location: i };
		});
	});
}
function G(n) {
	return new Worker('' + new URL('../workers/worker-CLZttF1_.js', import.meta.url).href, {
		name: n == null ? void 0 : n.name
	});
}
function H(n) {
	let e, t, a, u, l, i, c, m, g;
	return {
		c() {
			(e = h('p')),
				(t = k('Main Thread Time: ')),
				(a = k(n[0])),
				(u = k(' ms')),
				(l = v()),
				(i = h('p')),
				(c = k('Worker Time: ')),
				(m = k(n[1])),
				(g = k(' ms'));
		},
		l(r) {
			e = T(r, 'P', {});
			var o = C(e);
			(t = w(o, 'Main Thread Time: ')),
				(a = w(o, n[0])),
				(u = w(o, ' ms')),
				o.forEach(_),
				(l = W(r)),
				(i = T(r, 'P', {}));
			var s = C(i);
			(c = w(s, 'Worker Time: ')), (m = w(s, n[1])), (g = w(s, ' ms')), s.forEach(_);
		},
		m(r, o) {
			b(r, e, o), p(e, t), p(e, a), p(e, u), b(r, l, o), b(r, i, o), p(i, c), p(i, m), p(i, g);
		},
		p(r, o) {
			o & 1 && A(a, r[0]), o & 2 && A(m, r[1]);
		},
		d(r) {
			r && (_(e), _(l), _(i));
		}
	};
}
function D(n) {
	let e,
		t = 'Running worker test...';
	return {
		c() {
			(e = h('p')), (e.textContent = t);
		},
		l(a) {
			(e = T(a, 'P', { 'data-svelte-h': !0 })), L(e) !== 'svelte-5wzbe7' && (e.textContent = t);
		},
		m(a, u) {
			b(a, e, u);
		},
		p: y,
		d(a) {
			a && _(e);
		}
	};
}
function F(n) {
	let e,
		t,
		a = 'Run Main Thread Test',
		u,
		l,
		i = 'Run Worker Test',
		c,
		m,
		g;
	function r(f, d) {
		return f[2] ? D : H;
	}
	let o = r(n),
		s = o(n);
	return {
		c() {
			(e = h('div')),
				(t = h('button')),
				(t.textContent = a),
				(u = v()),
				(l = h('button')),
				(l.textContent = i),
				(c = v()),
				s.c();
		},
		l(f) {
			e = T(f, 'DIV', {});
			var d = C(e);
			(t = T(d, 'BUTTON', { 'data-svelte-h': !0 })),
				L(t) !== 'svelte-1q0wje4' && (t.textContent = a),
				(u = W(d)),
				(l = T(d, 'BUTTON', { 'data-svelte-h': !0 })),
				L(l) !== 'svelte-1hn2fzg' && (l.textContent = i),
				(c = W(d)),
				s.l(d),
				d.forEach(_);
		},
		m(f, d) {
			b(f, e, d),
				p(e, t),
				p(e, u),
				p(e, l),
				p(e, c),
				s.m(e, null),
				m || ((g = [M(t, 'click', n[3]), M(l, 'click', n[4])]), (m = !0));
		},
		p(f, [d]) {
			o === (o = r(f)) && s ? s.p(f, d) : (s.d(1), (s = o(f)), s && (s.c(), s.m(e, null)));
		},
		i: y,
		o: y,
		d(f) {
			f && _(e), s.d(), (m = !1), j(g);
		}
	};
}
function K(n, e, t) {
	let { data: a } = e,
		u = 0,
		l = 0,
		i = !1,
		c;
	function m() {
		const r = performance.now(),
			o = E(a.images),
			s = performance.now();
		t(0, (u = s - r)), console.log('Worker t:', u), console.log('Main thread result:', o);
	}
	function g() {
		t(2, (i = !0));
		const r = performance.now();
		c.postMessage(a.images),
			(c.onmessage = (o) => {
				const s = performance.now();
				t(1, (l = s - r)),
					console.log('Worker t:', l),
					console.log('Worker result:', o.data),
					t(2, (i = !1)),
					c.terminate();
			});
	}
	return (
		O(() => {
			(c = new G()), E(a.images);
		}),
		(n.$$set = (r) => {
			'data' in r && t(5, (a = r.data));
		}),
		[u, l, i, m, g, a]
	);
}
class X extends N {
	constructor(e) {
		super(), z(this, e, K, F, S, { data: 5 });
	}
}
export { X as component, Q as universal };

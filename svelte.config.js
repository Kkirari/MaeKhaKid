import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Static SPA: ทุก route ใช้ index.html เป็น fallback (client-side routing)
		adapter: adapter({
			fallback: 'index.html',
			precompress: false
		})
	}
};

export default config;

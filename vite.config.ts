import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import legacy from '@vitejs/plugin-legacy';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		tailwindcss(),
		sveltekit(),
		legacy({ targets: ['defaults', 'not IE 11'] })
	]
});

<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { loadCatalog } from '$lib/stores/catalog';
	import { seedIfEmpty } from '$lib/db/seed';
	import { syncPendingSales, isCloudEnabled } from '$lib/sync/sync';
	import { settings } from '$lib/settings';

	let { children } = $props();

	let ready = $state(false);
	let now = $state(new Date());

	const tabs = [
		{ href: '/', label: 'ขาย' },
		{ href: '/products', label: 'สินค้า' },
		{ href: '/summary', label: 'สรุปยอด' }
	];

	const clock = $derived(
		now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
	);
	const today = $derived(
		now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
	);

	onMount(() => {
		let syncTimer: ReturnType<typeof setInterval> | undefined;
		const clockTimer = setInterval(() => (now = new Date()), 1000 * 20);
		(async () => {
			await seedIfEmpty();
			await loadCatalog();
			ready = true;
			if (isCloudEnabled()) {
				syncPendingSales();
				syncTimer = setInterval(() => syncPendingSales(), 60_000);
			}
		})();
		return () => {
			clearInterval(clockTimer);
			if (syncTimer) clearInterval(syncTimer);
		};
	});
</script>

<div class="relative z-10 flex h-full flex-col">
	<!-- ===== แถบหัว ===== -->
	<header
		class="flex shrink-0 items-center gap-3 border-b-2 border-line bg-paper-2/70 px-4 py-2.5"
	>
		<!-- โลโก้ + ชื่อร้าน -->
		<a href="/" class="flex items-center gap-2.5">
			<span
				class="flex h-10 w-10 items-center justify-center rounded-full bg-forest text-xl text-white"
				style="box-shadow: 0 3px 0 var(--color-forest-ink)">🧺</span
			>
			<div class="leading-none">
				<div class="font-display text-lg font-bold text-ink">{$settings.shopName}</div>
				<div class="font-display text-[0.7rem] font-semibold tracking-widest text-ink-soft">
					LUKMAEKHA&nbsp;·&nbsp;POS
				</div>
			</div>
		</a>

		<!-- แท็บนำทาง -->
		<nav class="mx-auto flex gap-1 rounded-full border border-line bg-card p-1">
			{#each tabs as tab (tab.href)}
				{@const active = $page.url.pathname === tab.href}
				<a href={tab.href} class="tab {active ? 'tab-active' : ''}">{tab.label}</a>
			{/each}
		</nav>

		<!-- นาฬิกา -->
		<div class="text-right leading-none">
			<div class="font-display text-xl font-bold tnum text-ink">{clock}</div>
			<div class="text-xs text-ink-soft">{today}</div>
		</div>
	</header>

	<!-- ===== เนื้อหา ===== -->
	<main class="relative flex-1 overflow-hidden">
		{#if ready}
			{@render children()}
		{:else}
			<div class="flex h-full flex-col items-center justify-center gap-3 text-ink-soft">
				<span class="animate-pop text-5xl">🛒</span>
				<span class="font-display">กำลังเปิดร้าน…</span>
			</div>
		{/if}
	</main>
</div>

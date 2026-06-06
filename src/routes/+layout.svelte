<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { loadCatalog } from '$lib/stores/catalog';
	import { seedIfEmpty } from '$lib/db/seed';
	import { syncPendingSales, syncProducts, pullProductsIfEmpty, pullSalesIfEmpty, isCloudEnabled, syncStatus } from '$lib/sync/sync';
	import { settings } from '$lib/settings';
	import { initAuth, authUser, signOut } from '$lib/stores/auth';
	import { clearAllData } from '$lib/db/schema';
	import SettingsModal from '$lib/components/SettingsModal.svelte';

	let { children } = $props();

	let ready = $state(false);
	let now = $state(new Date());
	let showSettings = $state(false);
	let authInited = $state(false);

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

	const isAuthPage = $derived(
		$page.url.pathname === '/login' || $page.url.pathname === '/onboard'
	);

	async function handleSignOut() {
		if (isCloudEnabled() && $authUser) {
			await syncPendingSales();
			await syncProducts();
		}
		await signOut();
		await clearAllData();
		goto('/login');
	}

	async function bootstrap() {
		await initAuth();
		settings.loadForUser($authUser?.id || null);
		authInited = true;

		const path = $page.url.pathname;

		// Auth guard
		if (isCloudEnabled() && !$authUser && path !== '/login' && path !== '/onboard') {
			goto('/login');
			return;
		}

		// Onboard guard
		if (!$settings.onboarded && path !== '/login' && path !== '/onboard') {
			goto('/onboard');
			return;
		}

		if (path === '/login' || path === '/onboard') {
			ready = true;
			return;
		}

		// Dev mode seed
		if ($settings.devMode) await seedIfEmpty();

		await loadCatalog();

		if (isCloudEnabled() && $authUser) {
			await pullProductsIfEmpty();
			await pullSalesIfEmpty();
			await loadCatalog();
			syncPendingSales();
			syncProducts();
			return 'cloud';
		}
		ready = true;
		return 'local';
	}

	$effect(() => {
		// Ensure settings key is synced with the current user
		settings.loadForUser($authUser?.id || null);
	});

	// Lightweight reactive guard: when user logs in or completes onboard,
	// detect the state change and re-bootstrap (without the expensive $effect loop)
	$effect(() => {
		// Track only the values that matter for post-login/onboard transitions
		const user = $authUser;
		const onboarded = $settings.onboarded;

		// Only act after initial auth check is done — skip the first run
		if (!authInited) return;

		const path = $page.url.pathname;

		// Active guards for client-side navigation
		if (isCloudEnabled() && !user && path !== '/login' && path !== '/onboard') {
			goto('/login');
			return;
		}
		if (!onboarded && path !== '/login' && path !== '/onboard') {
			goto('/onboard');
			return;
		}

		// User just logged in and is still on /login → redirect
		if (user && path === '/login') {
			if (!onboarded) {
				goto('/onboard');
			} else {
				// Re-bootstrap for the logged-in user
				ready = false;
				(async () => {
					if ($settings.devMode) await seedIfEmpty();
					if (isCloudEnabled() && $authUser) {
						await pullProductsIfEmpty();
						await pullSalesIfEmpty();
					}
					await loadCatalog();
					if (isCloudEnabled() && $authUser) {
						syncPendingSales();
						syncProducts();
					}
					ready = true;
					goto('/');
				})();
			}
			return;
		}

		// User just finished onboarding
		if (onboarded && path === '/onboard') {
			ready = false;
			(async () => {
				if ($settings.devMode) await seedIfEmpty();
				if (isCloudEnabled() && $authUser) {
					await pullProductsIfEmpty();
					await pullSalesIfEmpty();
				}
				await loadCatalog();
				if (isCloudEnabled() && $authUser) {
					syncPendingSales();
					syncProducts();
				}
				ready = true;
				goto('/');
			})();
			return;
		}
	});

	onMount(() => {
		let syncTimer: ReturnType<typeof setInterval> | undefined;
		const clockTimer = setInterval(() => (now = new Date()), 1000);

		(async () => {
			const mode = await bootstrap();
			if (mode === 'cloud') {
				syncTimer = setInterval(() => {
					syncPendingSales();
					syncProducts();
				}, 60_000);
				ready = true;
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
		{#if !isAuthPage}
			<nav class="mx-auto flex gap-1 rounded-full border border-line bg-card p-1">
				{#each tabs as tab (tab.href)}
					{@const active = $page.url.pathname === tab.href}
					<a href={tab.href} class="tab {active ? 'tab-active' : ''}">{tab.label}</a>
				{/each}
			</nav>
		{:else}
			<div class="mx-auto"></div>
		{/if}

		<!-- ขวา: ตั้งค่า + logout + นาฬิกา -->
		<div class="flex items-center gap-2">
			{#if !isAuthPage}
				{#if isCloudEnabled() && $authUser}
					{#if $syncStatus.error}
						<span
							class="h-3 w-3 rounded-full shrink-0"
							style="background-color: var(--color-alert); border: 2px solid var(--color-paper-2);"
							title="การเชื่อมโยงข้อมูลขัดข้อง"
						></span>
					{:else if $syncStatus.pending > 0}
						<span
							class="h-3 w-3 rounded-full shrink-0 animate-pulse"
							style="background-color: var(--color-gold); border: 2px solid var(--color-paper-2);"
							title="กำลังเชื่อมโยงข้อมูล ({$syncStatus.pending} รายการ)"
						></span>
					{/if}
				{/if}
				<button
					onclick={() => (showSettings = true)}
					class="btn btn-ghost px-3 py-2 text-lg"
					title="ตั้งค่าร้าน"
					aria-label="ตั้งค่า"
				>⚙️</button>
			{/if}
			{#if $authUser && !isAuthPage}
				<button onclick={handleSignOut} class="btn btn-ghost px-3 py-1 text-sm">
					ออกจากระบบ
				</button>
			{/if}
			<div class="text-right leading-none">
				<div class="font-display text-xl font-bold tnum text-ink">{clock}</div>
				<div class="text-xs text-ink-soft">{today}</div>
			</div>
		</div>
	</header>

	<!-- ===== เนื้อหา ===== -->
	<main class="relative flex-1 overflow-hidden">
		{#if isAuthPage}
			{@render children()}
		{:else if ready}
			{@render children()}
		{:else}
			<div class="flex h-full flex-col items-center justify-center gap-3 text-ink-soft">
				<span class="animate-pop text-5xl">🛒</span>
				<span class="font-display">กำลังเปิดร้าน…</span>
			</div>
		{/if}
	</main>
</div>

{#if showSettings}
	<SettingsModal onclose={() => (showSettings = false)} />
{/if}

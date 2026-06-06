<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { cart, cartTotals } from '$lib/stores/cart';
	import { products, lookupBarcode, lowStockProducts } from '$lib/stores/catalog';
	import { fmtBaht } from '$lib/format';
	import { beepOk, beepError } from '$lib/sound';
	import PaymentModal from '$lib/components/PaymentModal.svelte';
	import type { Product } from '$lib/db/schema';
	import { settings } from '$lib/settings';

	const PAGE_SIZE = 9; // 3 x 3 ต่อหน้า

	let scanInput = $state<HTMLInputElement | null>(null);
	let gridScroll = $state<HTMLDivElement | null>(null);
	let scanValue = $state('');
	let searchQuery = $state('');
	let inputSearchQuery = $state('');
	let paymentOpen = $state(false);
	let currentPage = $state(0);
	let toast = $state('');
	let toastKind = $state<'ok' | 'err'>('ok');
	let toastTimer: ReturnType<typeof setTimeout>;
	let flashKey = $state('');
	let flashTimer: ReturnType<typeof setTimeout>;

	$effect(() => {
		const q = inputSearchQuery;
		const timer = setTimeout(() => {
			searchQuery = q;
		}, 250);
		return () => clearTimeout(timer);
	});

	const filtered = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		let base = $products;
		
		if (q) {
			base = base.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q));
		}
		
		const pinnedIds = new Set($settings.pinnedProductIds || []);
		
		if ($settings.pinMode === 'pinned') {
			base = base.filter((p) => pinnedIds.has(p.id));
		}
		
		base.sort((a, b) => {
			const aPinned = pinnedIds.has(a.id);
			const bPinned = pinnedIds.has(b.id);
			if (aPinned && !bPinned) return -1;
			if (!aPinned && bPinned) return 1;
			return 0;
		});

		return base;
	});

	const pages = $derived.by(() => {
		const out: Product[][] = [];
		for (let i = 0; i < filtered.length; i += PAGE_SIZE) out.push(filtered.slice(i, i + PAGE_SIZE));
		return out.length ? out : [[]];
	});

	// คุมหน้าให้อยู่ในช่วง + รีเซ็ตเมื่อค้นหา
	$effect(() => {
		const max = pages.length - 1;
		if (currentPage > max) {
			currentPage = 0;
			if (gridScroll) gridScroll.scrollLeft = 0;
		}
	});

	function showToast(msg: string, kind: 'ok' | 'err' = 'ok') {
		toast = msg;
		toastKind = kind;
		clearTimeout(toastTimer);
		toastTimer = setTimeout(() => (toast = ''), 1800);
	}

	function flash(key: string) {
		flashKey = '';
		clearTimeout(flashTimer);
		requestAnimationFrame(() => {
			flashKey = key;
			flashTimer = setTimeout(() => (flashKey = ''), 650);
		});
	}

	async function refocusScan() {
		await tick();
		if (!paymentOpen) scanInput?.focus();
	}

	function handleScanKey(e: KeyboardEvent) {
		if (e.key !== 'Enter') return;
		e.preventDefault();
		const code = scanValue.trim();
		scanValue = '';
		if (!code) return;
		const product = lookupBarcode(code);
		if (product) {
			cart.addProduct(product);
			beepOk();
			flash(product.id);
		} else {
			beepError();
			showToast('ไม่พบบาร์โค้ด: ' + code, 'err');
		}
	}

	function addFromGrid(product: Product) {
		cart.addProduct(product);
		beepOk();
		flash(product.id);
		refocusScan();
	}

	function onScanBlur() {
		setTimeout(() => {
			const el = document.activeElement;
			const tag = el?.tagName ?? '';
			if (!paymentOpen && !['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA'].includes(tag)) {
				scanInput?.focus();
			}
		}, 80);
	}

	function goToPage(p: number) {
		const page = Math.max(0, Math.min(p, pages.length - 1));
		currentPage = page;
		if (gridScroll) gridScroll.scrollTo({ left: page * gridScroll.clientWidth, behavior: 'smooth' });
	}

	function onGridScroll() {
		if (!gridScroll) return;
		const p = Math.round(gridScroll.scrollLeft / gridScroll.clientWidth);
		if (p !== currentPage) currentPage = p;
	}

	function openPayment() {
		if ($cartTotals.lineCount === 0) return;
		paymentOpen = true;
	}

	function onPaymentDone() {
		paymentOpen = false;
		showToast('บันทึกการขายแล้ว ✓', 'ok');
		products.update((list) => [...list]);
		refocusScan();
	}

	function togglePinMode() {
		settings.save({ pinMode: $settings.pinMode === 'pinned' ? 'all' : 'pinned' });
	}

	function togglePin(e: MouseEvent, productId: string) {
		e.stopPropagation();
		const currentPins = new Set($settings.pinnedProductIds || []);
		if (currentPins.has(productId)) {
			currentPins.delete(productId);
		} else {
			currentPins.add(productId);
		}
		settings.save({ pinnedProductIds: Array.from(currentPins) });
	}

	onMount(() => {
		refocusScan();
	});
</script>

<div class="flex h-full gap-3 p-3">
	<!-- ===== ซ้าย: ใบเสร็จ (1) ===== -->
	<section class="card relative flex w-1/2 flex-col overflow-hidden p-0">
		<div
			class="h-2.5 w-full shrink-0"
			style="background:
				linear-gradient(135deg, var(--color-card) 25%, transparent 25%) -8px 0/16px 16px,
				linear-gradient(225deg, var(--color-card) 25%, transparent 25%) -8px 0/16px 16px,
				var(--color-line)"
		></div>

		<div class="flex items-center justify-between px-4 pt-3">
			<h2 class="font-display text-lg font-bold text-ink">
				ใบเสร็จ <span class="text-ink-soft">· {$cartTotals.count} ชิ้น</span>
			</h2>
			{#if $cart.length > 0}
				<button class="btn btn-ghost px-2 py-1 text-sm" style="color:var(--color-alert)" onclick={() => cart.clear()}>
					ล้าง
				</button>
			{/if}
		</div>

		<div class="my-2 border-t border-dashed border-line"></div>

		<div class="flex-1 overflow-y-auto px-3">
			{#if $cart.length === 0}
				<div class="flex h-full flex-col items-center justify-center gap-2 text-ink-soft">
					<div class="text-6xl opacity-40">🧾</div>
					<div class="font-display">ยังไม่มีรายการ</div>
					<div class="text-sm">สแกนหรือแตะสินค้าทางขวา</div>
				</div>
			{:else}
				{#each $cart as line (line.key)}
					<div class="mb-2 rounded-xl px-1 py-1 {flashKey === line.product_id ? 'flash-in' : ''}">
						<div class="flex items-baseline justify-between gap-2">
							<span class="min-w-0 flex-1 truncate font-medium text-ink">{line.name}</span>
							<span class="pricetag text-lg">{fmtBaht(line.price * line.qty)}</span>
						</div>
						<div class="mt-1 flex items-center justify-between">
							<div class="flex items-center gap-2.5">
								<button
									class="h-9 w-9 rounded-full bg-paper-2 text-xl font-bold text-ink active:scale-90"
									onclick={() => cart.setQty(line.key, line.qty - 1)}>−</button
								>
								<span class="w-7 text-center font-display text-lg font-bold tnum">{line.qty}</span>
								<button
									class="h-9 w-9 rounded-full bg-paper-2 text-xl font-bold text-ink active:scale-90"
									onclick={() => cart.setQty(line.key, line.qty + 1)}>+</button
								>
								<span class="ml-1 text-sm text-ink-soft tnum">× {fmtBaht(line.price)}</span>
							</div>
							<button
								class="px-1 text-ink-soft active:scale-90"
								onclick={() => cart.remove(line.key)}
								aria-label="ลบ">✕</button
							>
						</div>
					</div>
				{/each}
			{/if}
		</div>

		<div class="shrink-0 border-t-2 border-dashed border-line px-4 pb-4 pt-3">
			<div class="mb-3 flex items-end justify-between">
				<span class="font-display text-base font-semibold text-ink-soft">ยอดรวม</span>
				<span class="font-display text-4xl font-bold tnum" style="color:var(--color-clay-ink)">
					{fmtBaht($cartTotals.total)}<span class="ml-1 text-2xl">฿</span>
				</span>
			</div>
			<button
				class="btn btn-success w-full py-4 text-2xl"
				onclick={openPayment}
				disabled={$cartTotals.lineCount === 0}
			>
				ชำระเงิน
			</button>
		</div>
	</section>

	<!-- ===== ขวา: Quick Add (1) ===== -->
	<section class="flex w-1/2 flex-col gap-2.5">
		<div class="relative">
			<span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-2xl">📷</span>
			<input
				bind:this={scanInput}
				bind:value={scanValue}
				onkeydown={handleScanKey}
				onblur={onScanBlur}
				placeholder="สแกนบาร์โค้ด…"
				class="field py-4 font-display text-xl font-semibold"
				style="border-width:2.5px; border-color: var(--color-forest); padding-left:3.4rem"
				autocomplete="off"
				inputmode="none"
			/>
		</div>
		<div class="flex items-center gap-2">
			<div class="relative flex-1">
				<span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-ink-soft">🔍</span>
				<input
					bind:value={inputSearchQuery}
					placeholder="ค้นหาชื่อสินค้า…"
					class="field py-2.5"
					style="padding-left:3rem"
					autocomplete="off"
				/>
			</div>
			<button
				class="btn btn-soft h-11 px-3 font-display text-sm"
				onclick={togglePinMode}
				title="สลับการแสดงผลพิน"
			>
				{#if $settings.pinMode === 'pinned'}
					<span class="mr-1 text-amber-500">📌</span> เฉพาะพิน
				{:else}
					📋 ทั้งหมด
				{/if}
			</button>
		</div>

		<!-- แถบแจ้งเตือนสต๊อกต่ำ -->
		{#if $lowStockProducts.length > 0}
			<div
				class="flex shrink-0 items-center gap-2 overflow-x-auto rounded-2xl px-3 py-2 text-sm"
				style="background: #fef3c7; border: 1.5px solid #fcd34d; scrollbar-width: none"
			>
				<span class="shrink-0 font-semibold" style="color:#92400e">⚠️ สต๊อกต่ำ:</span>
				{#each $lowStockProducts as p (p.id)}
					<span class="shrink-0 rounded-full bg-amber-200 px-2.5 py-0.5 font-medium tnum" style="color:#78350f">
						{p.name} ({p.stock}{p.unit ? ' ' + p.unit : ''})
					</span>
				{/each}
			</div>
		{/if}

		<!-- กริดสินค้าแบบเลื่อนหน้า (3x3) -->
		{#if filtered.length === 0}
			<div class="mt-12 text-center text-ink-soft">
				<div class="text-4xl">🫙</div>
				<div class="mt-2 font-display">ไม่พบสินค้า</div>
			</div>
		{:else}
			<div
				bind:this={gridScroll}
				onscroll={onGridScroll}
				class="flex min-h-0 flex-1 snap-x snap-mandatory overflow-x-auto overflow-y-hidden"
				style="scrollbar-width: none; -ms-overflow-style: none"
			>
				{#each pages as pageItems, pi (pi)}
					<div class="grid w-full shrink-0 snap-start grid-cols-3 grid-rows-3 gap-2.5 pr-0.5">
						{#each pageItems as product (product.id)}
							<div
								role="button"
								tabindex="0"
								class="card relative flex flex-col overflow-hidden p-0 text-left active:translate-y-0.5 cursor-pointer"
								style="box-shadow: 0 3px 0 var(--color-line)"
								onclick={() => addFromGrid(product)}
								onkeydown={(e) => e.key === 'Enter' && addFromGrid(product)}
							>
								<!-- ปุ่มพิน -->
								<button
									class="absolute left-1.5 top-1.5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-paper/80 shadow backdrop-blur transition-transform hover:scale-110 active:scale-95"
									onclick={(e) => togglePin(e, product.id)}
									title={$settings.pinnedProductIds?.includes(product.id) ? 'เลิกพิน' : 'พินสินค้านี้'}
								>
									{#if $settings.pinnedProductIds?.includes(product.id)}
										<span class="text-base text-amber-500">📌</span>
									{:else}
										<span class="text-base text-ink-soft opacity-60">📌</span>
									{/if}
								</button>
								<!-- รูปสินค้า (full-bleed banner) -->
								{#if product.image_url}
									<img
										src={product.image_url}
										alt={product.name}
										class="w-full shrink-0 object-cover"
										style="height:58px"
										loading="lazy"
										onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
									/>
								{/if}
								<!-- Stock-out badge -->
								{#if product.stock <= 0}
									<span
										class="absolute right-0 top-0 rounded-bl-lg px-2 py-0.5 text-[0.65rem] font-bold text-white"
										style="background:var(--color-alert)">หมด</span
									>
								{/if}
								<!-- Content -->
								<div class="flex flex-1 flex-col justify-center gap-1.5 p-2.5">
									<div
										class="line-clamp-2 shrink-0 font-display font-semibold leading-tight text-ink"
										style="font-size:clamp(0.95rem, 1.5vw, 1.35rem)"
									>
										{product.name}
									</div>
									<div class="flex items-end justify-between gap-1">
										<span class="pricetag" style="font-size:clamp(1.4rem, 2.8vw, 2.2rem)"
											>{fmtBaht(product.price)}<span class="ml-0.5 text-base font-semibold">฿</span></span
										>
										<span
											class="shrink-0 rounded-full px-2 py-0.5 text-xs tnum {product.stock <= 0
												? 'text-white'
												: 'bg-paper-2 text-ink-soft'}"
											style={product.stock <= 0 ? 'background:var(--color-alert)' : ''}
											>{product.stock}{product.unit ? ' ' + product.unit : ''}</span
										>
									</div>
								</div>
							</div>
						{/each}
					</div>
				{/each}
			</div>

			<!-- แถบเลื่อนหน้า -->
			{#if pages.length > 1}
				<div class="flex shrink-0 items-center gap-3 px-1 pt-1">
					<button
						class="btn btn-soft h-10 w-10 shrink-0 p-0 text-xl"
						onclick={() => goToPage(currentPage - 1)}
						disabled={currentPage === 0}
						aria-label="ก่อนหน้า">‹</button
					>
					<input
						class="pager-slider flex-1"
						type="range"
						min="0"
						max={pages.length - 1}
						step="1"
						value={currentPage}
						oninput={(e) => goToPage(+e.currentTarget.value)}
						aria-label="เลื่อนหน้าสินค้า"
					/>
					<span class="shrink-0 font-display text-sm font-semibold tnum text-ink-soft">
						{currentPage + 1}/{pages.length}
					</span>
					<button
						class="btn btn-soft h-10 w-10 shrink-0 p-0 text-xl"
						onclick={() => goToPage(currentPage + 1)}
						disabled={currentPage === pages.length - 1}
						aria-label="ถัดไป">›</button
					>
				</div>
			{/if}
		{/if}
	</section>
</div>

{#if toast}
	<div
		class="animate-pop fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-2xl px-6 py-3 font-display font-semibold text-white shadow-lg"
		style="background: {toastKind === 'ok' ? 'var(--color-forest)' : 'var(--color-alert)'}"
	>
		{toast}
	</div>
{/if}

{#if paymentOpen}
	<PaymentModal
		total={$cartTotals.total}
		lines={$cart}
		onClose={() => {
			paymentOpen = false;
			refocusScan();
		}}
		onDone={onPaymentDone}
	/>
{/if}

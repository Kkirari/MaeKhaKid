<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getAllProducts,
		saveProduct,
		deleteProduct,
		isBarcodeTaken,
		type ProductInput
	} from '$lib/db/products';
	import { loadCatalog } from '$lib/stores/catalog';
	import { settings } from '$lib/settings';
	import { fmtBaht } from '$lib/format';
	import { fetchBarcodeDetails } from '$lib/barcode-image';
	import type { Product } from '$lib/db/schema';

	let items = $state<Product[]>([]);
	let query = $state('');
	let filter = $state<'all' | 'low' | 'out' | 'inactive'>('all');
	let sort = $state<'name' | 'price' | 'stock'>('name');
	let showForm = $state(false);
	let showSettings = $state(false);
	let formError = $state('');
	let adjustingId = $state<string | null>(null);
	let view = $state<'row' | 'card'>('row');
	let fetchingImage = $state(false);
	let imageNotFound = $state(false);
	let barcodeTimer: ReturnType<typeof setTimeout>;

	let editingId = $state<string | null>(null);
	let f = $state({
		barcode: '',
		name: '',
		price: '' as number | string,
		cost: '' as number | string,
		stock: '' as number | string,
		min_stock: '' as number | string,
		category: '',
		unit: '',
		is_active: true,
		image_url: ''
	});

	let sShopName = $state('');
	let sPromptpay = $state('');
	let sLineToken = $state('');

	const filtered = $derived.by(() => {
		const q = query.trim().toLowerCase();
		let list = items;

		// text search
		if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q));

		// filter chips
		if (filter === 'low') list = list.filter((p) => p.min_stock != null && p.stock > 0 && p.stock <= p.min_stock);
		else if (filter === 'out') list = list.filter((p) => p.stock <= 0);
		else if (filter === 'inactive') list = list.filter((p) => p.is_active === 0);
		else list = list.filter((p) => p.is_active === 1); // 'all' shows active only

		// sort
		if (sort === 'price') list = [...list].sort((a, b) => a.price - b.price);
		else if (sort === 'stock') list = [...list].sort((a, b) => a.stock - b.stock);
		// default: name already sorted from getAllProducts

		return list;
	});

	const lowCount = $derived(items.filter((p) => p.min_stock != null && p.stock > 0 && p.stock <= p.min_stock && p.is_active === 1).length);
	const outCount = $derived(items.filter((p) => p.stock <= 0 && p.is_active === 1).length);
	const inactiveCount = $derived(items.filter((p) => p.is_active === 0).length);

	async function reload() {
		items = await getAllProducts();
		await loadCatalog();
	}

	function cardState(p: Product): 'inactive' | 'out' | 'low' | 'normal' {
		if (p.is_active === 0) return 'inactive';
		if (p.stock <= 0) return 'out';
		if (p.min_stock != null && p.stock <= p.min_stock) return 'low';
		return 'normal';
	}

	function stockBarWidth(p: Product): number {
		const max = p.min_stock != null ? p.min_stock * 4 : 20;
		return Math.min(100, Math.round((p.stock / Math.max(max, 1)) * 100));
	}

	async function tryFetchImage() {
		const code = f.barcode.trim();
		if (code.length < 8) return;
		fetchingImage = true;
		imageNotFound = false;
		try {
			const details = await fetchBarcodeDetails(code);
			if (details) {
				if (details.image_url) f.image_url = details.image_url;
				// เติมเฉพาะฟิลด์ที่ยังว่างอยู่ — ไม่เขียนทับสิ่งที่ผู้ใช้พิมพ์ไปแล้ว
				if (!f.name.trim() && details.name) f.name = details.name;
				if (!f.category.trim() && details.category) f.category = details.category;
				imageNotFound = !details.image_url;
			} else {
				imageNotFound = true;
			}
		} finally {
			fetchingImage = false;
		}
	}

	function onBarcodeInput() {
		clearTimeout(barcodeTimer);
		imageNotFound = false;
		if (f.barcode.trim().length >= 8) {
			barcodeTimer = setTimeout(tryFetchImage, 600);
		}
	}

	async function adjustStock(p: Product, delta: number) {
		const newStock = p.stock + delta;
		if (newStock < 0) return;
		adjustingId = p.id;
		try {
			await saveProduct({ ...p, stock: newStock });
			await reload();
		} finally {
			adjustingId = null;
		}
	}

	function openAdd() {
		editingId = null;
		formError = '';
		fetchingImage = false;
		imageNotFound = false;
		f = { barcode: '', name: '', price: '', cost: '', stock: '', min_stock: '', category: '', unit: '', is_active: true, image_url: '' };
		showForm = true;
	}

	function openEdit(p: Product) {
		editingId = p.id;
		formError = '';
		fetchingImage = false;
		imageNotFound = false;
		f = {
			barcode: p.barcode ?? '',
			name: p.name,
			price: p.price,
			cost: p.cost ?? '',
			stock: p.stock,
			min_stock: p.min_stock ?? '',
			category: p.category ?? '',
			unit: p.unit ?? '',
			is_active: p.is_active === 1,
			image_url: p.image_url ?? ''
		};
		showForm = true;
	}

	async function submit() {
		formError = '';
		if (!f.name.trim()) { formError = 'กรุณาใส่ชื่อสินค้า'; return; }
		const barcode = f.barcode.trim();
		if (barcode && (await isBarcodeTaken(barcode, editingId ?? undefined))) {
			formError = 'บาร์โค้ดนี้มีสินค้าอื่นใช้แล้ว';
			return;
		}
		const input: ProductInput = {
			id: editingId ?? undefined,
			barcode: barcode || null,
			name: f.name,
			price: Number(f.price) || 0,
			cost: f.cost === '' ? undefined : Number(f.cost),
			stock: Number(f.stock) || 0,
			min_stock: f.min_stock === '' ? undefined : Number(f.min_stock),
			category: f.category,
			unit: f.unit,
			is_active: f.is_active ? 1 : 0,
			image_url: f.image_url || undefined
		};
		await saveProduct(input);
		showForm = false;
		await reload();
	}

	async function remove(p: Product) {
		if (!confirm(`ลบ "${p.name}" ?`)) return;
		await deleteProduct(p.id);
		showForm = false;
		await reload();
	}

	function openSettings() {
		sShopName = $settings.shopName;
		sPromptpay = $settings.promptpayId;
		sLineToken = $settings.lineNotifyToken;
		showSettings = true;
	}
	function saveSettings() {
		settings.save({ shopName: sShopName.trim(), promptpayId: sPromptpay.trim(), lineNotifyToken: sLineToken.trim() });
		showSettings = false;
	}

	onMount(reload);
</script>

<div class="flex h-full flex-col gap-2.5 p-3">
	<!-- ===== Header ===== -->
	<div class="flex flex-wrap items-center gap-2">
		<h1 class="font-display text-2xl font-bold text-ink">สินค้า</h1>
		<span class="rounded-full bg-paper-2 px-2.5 py-0.5 text-sm font-semibold tnum text-ink-soft">{items.filter(p=>p.is_active===1).length}</span>
		<div class="relative flex-1" style="min-width:160px">
			<span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft">🔍</span>
			<input bind:value={query} placeholder="ค้นหา…" class="field py-2" style="padding-left:2.6rem" />
		</div>
		<!-- Sort -->
		<select bind:value={sort} class="field w-auto py-2 pr-8 text-sm font-semibold" style="background-image:none">
			<option value="name">ชื่อ A→Z</option>
			<option value="price">ราคา ต่ำ→สูง</option>
			<option value="stock">สต๊อก น้อย→มาก</option>
		</select>
		<button class="btn btn-soft py-2" onclick={() => (view = view === 'row' ? 'card' : 'row')}
			title={view === 'row' ? 'มุมมองการ์ด' : 'มุมมองแถว'}>
			{view === 'row' ? '⊞' : '☰'}
		</button>
		<button class="btn btn-soft py-2" onclick={openSettings}>⚙️</button>
		<button class="btn btn-primary py-2" onclick={openAdd}>+ เพิ่ม</button>
	</div>

	<!-- ===== Filter chips ===== -->
	<div class="flex shrink-0 gap-2">
		{#each [
			{ key: 'all',      label: 'ทั้งหมด',    count: null },
			{ key: 'low',      label: 'สต๊อกต่ำ',   count: lowCount },
			{ key: 'out',      label: 'หมด',         count: outCount },
			{ key: 'inactive', label: 'ปิดขาย',     count: inactiveCount }
		] as chip (chip.key)}
			<button
				class="flex items-center gap-1.5 rounded-2xl px-4 py-2 font-display text-sm font-semibold transition-all"
				style={filter === chip.key
					? 'background:var(--color-forest);color:#fff;box-shadow:0 3px 0 var(--color-forest-ink)'
					: 'background:var(--color-card);color:var(--color-ink-soft);box-shadow:0 2px 0 var(--color-line)'}
				onclick={() => (filter = chip.key as typeof filter)}
			>
				{chip.label}
				{#if chip.count}
					<span class="rounded-full px-1.5 py-0.5 text-xs tnum"
						style={filter === chip.key ? 'background:rgba(255,255,255,0.25)' : 'background:var(--color-paper-2)'}
					>{chip.count}</span>
				{/if}
			</button>
		{/each}
	</div>

	<!-- ===== List / Card ===== -->
	<div class="flex-1 overflow-y-auto">
		{#if filtered.length === 0}
			<div class="mt-20 text-center text-ink-soft">
				<div class="text-5xl">📦</div>
				<div class="mt-2 font-display">ไม่พบสินค้า</div>
			</div>
		{:else if view === 'row'}
			<!-- ===== Row view ===== -->
			<div class="flex flex-col gap-2">
				{#each filtered as p, i (p.id)}
					{@const state = cardState(p)}
					{@const barW = stockBarWidth(p)}
					{@const barColor = state === 'out' ? 'var(--color-alert)' : state === 'low' ? '#d97706' : 'var(--color-forest)'}
					<div
						class="flex items-center gap-3 overflow-hidden rounded-2xl border-2 px-3 py-2.5"
						style="
							animation: rise 0.25s cubic-bezier(0.16,1,0.3,1) both;
							animation-delay: {Math.min(i * 8, 200)}ms;
							background: {state === 'low' ? '#fef9ee' : state === 'out' ? '#fdf2f0' : state === 'inactive' ? '#f4f0e8' : 'var(--color-card)'};
							border-color: {state === 'low' ? '#fcd34d' : state === 'out' ? '#fca89a' : 'var(--color-line)'};
							opacity: {state === 'inactive' ? '0.6' : '1'}
						"
					>
						<!-- รูป / placeholder -->
						<div class="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl" style="background:var(--color-paper-2)">
							{#if p.image_url}
								<img
									src={p.image_url}
									alt={p.name}
									class="h-full w-full object-cover"
									loading="lazy"
									onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display='none'; }}
								/>
							{:else}
								<span class="flex h-full w-full items-center justify-center text-xl opacity-30">🛒</span>
							{/if}
							{#if state === 'out'}
								<span class="absolute inset-0 flex items-center justify-center rounded-xl text-[0.6rem] font-bold text-white" style="background:rgba(173,74,45,0.82)">หมด</span>
							{/if}
						</div>

						<!-- ชื่อ + หมวด -->
						<button class="min-w-0 flex-1 text-left" onclick={() => openEdit(p)}>
							<div class="truncate font-display font-semibold leading-tight text-ink">{p.name}</div>
							<div class="mt-0.5 flex items-center gap-2">
								{#if p.category}
									<span class="rounded-full px-2 py-0.5 text-xs font-medium" style="background:var(--color-paper-2);color:var(--color-ink-soft)">{p.category}</span>
								{/if}
								<span class="tnum text-sm font-semibold" style="color:var(--color-clay)">{fmtBaht(p.price)} ฿</span>
								{#if state === 'low'}
									<span class="text-xs font-bold" style="color:#d97706">⚠️ต่ำ</span>
								{:else if state === 'inactive'}
									<span class="text-xs text-ink-soft">ปิด</span>
								{/if}
							</div>
						</button>

						<!-- Stock bar + count -->
						<div class="hidden w-24 shrink-0 sm:block">
							<div class="h-2 w-full overflow-hidden rounded-full" style="background:var(--color-paper-2)">
								<div class="h-full rounded-full transition-all" style="width:{barW}%; background:{barColor}"></div>
							</div>
							<div class="mt-1 text-right tnum text-sm font-bold" style="color:{barColor}">
								{p.stock}{p.unit ? ' ' + p.unit : ''}
							</div>
						</div>

						<!-- ± buttons -->
						<div class="flex shrink-0 items-center gap-1.5">
							<button
								class="flex h-11 w-11 items-center justify-center rounded-full font-display text-xl font-bold text-ink-soft active:scale-90"
								style="background:var(--color-paper-2)"
								onclick={() => adjustStock(p, -1)}
								disabled={p.stock <= 0 || adjustingId === p.id}
								aria-label="ลดสต๊อก">−</button
							>
							<span class="tnum w-8 text-center text-base font-bold sm:hidden" style="color:{barColor}">{p.stock}</span>
							<button
								class="flex h-11 w-11 items-center justify-center rounded-full font-display text-xl font-bold text-white active:scale-90"
								style="background:var(--color-forest);box-shadow:0 2px 0 var(--color-forest-ink)"
								onclick={() => adjustStock(p, 1)}
								disabled={adjustingId === p.id}
								aria-label="เพิ่มสต๊อก">+</button
							>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- ===== Card grid ===== -->
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-4">
				{#each filtered as p, i (p.id)}
					{@const state = cardState(p)}
					{@const barW = stockBarWidth(p)}
					{@const barColor = state === 'out' ? 'var(--color-alert)' : state === 'low' ? '#d97706' : 'var(--color-forest)'}
					<div
						class="relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all"
						style="
							animation: rise 0.3s cubic-bezier(0.16,1,0.3,1) both;
							animation-delay: {Math.min(i * 12, 240)}ms;
							background: {state === 'low' ? '#fef9ee' : state === 'out' ? '#fdf2f0' : state === 'inactive' ? '#f4f0e8' : 'var(--color-card)'};
							border-color: {state === 'low' ? '#fcd34d' : state === 'out' ? '#fca89a' : state === 'inactive' ? 'var(--color-line)' : 'var(--color-line)'};
							box-shadow: 0 3px 0 {state === 'low' ? '#f59e0b44' : state === 'out' ? 'var(--color-alert)44' : 'var(--color-line)'};
							opacity: {state === 'inactive' ? '0.55' : '1'}
						"
					>
						<!-- Status badge top-right -->
						{#if state === 'out'}
							<span class="absolute right-0 top-0 rounded-bl-xl px-2 py-1 text-xs font-bold text-white" style="background:var(--color-alert)">หมด</span>
						{:else if state === 'low'}
							<span class="absolute right-0 top-0 rounded-bl-xl px-2 py-1 text-xs font-bold" style="background:#fef08a;color:#78350f">⚠️ต่ำ</span>
						{:else if state === 'inactive'}
							<span class="absolute right-0 top-0 rounded-bl-xl px-2 py-1 text-xs font-bold text-ink-soft" style="background:var(--color-paper-2)">ปิด</span>
						{/if}

						<!-- รูปสินค้า (ถ้ามี) -->
						{#if p.image_url}
							<img
								src={p.image_url}
								alt={p.name}
								class="w-full object-cover"
								style="height:72px; border-radius:14px 14px 0 0; pointer-events:none"
								loading="lazy"
								onerror={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
							/>
						{/if}

						<!-- Card body → tap to edit -->
						<button class="flex flex-1 flex-col gap-2 p-3 text-left" onclick={() => openEdit(p)}>
							<!-- Category chip -->
							{#if p.category}
								<span class="self-start rounded-full px-2.5 py-0.5 text-xs font-semibold" style="background:var(--color-paper-2);color:var(--color-ink-soft)">{p.category}</span>
							{:else}
								<span class="self-start rounded-full px-2.5 py-0.5 text-xs" style="color:var(--color-line)">—</span>
							{/if}

							<!-- Name -->
							<div class="line-clamp-2 min-h-[2.8em] font-display text-lg font-semibold leading-snug text-ink">
								{p.name}
							</div>

							<!-- Stock bar -->
							<div class="h-2.5 w-full overflow-hidden rounded-full" style="background:var(--color-paper-2)">
								<div
									class="h-full rounded-full transition-all"
									style="width:{barW}%; background:{barColor}"
								></div>
							</div>

							<!-- Price + stock count -->
							<div class="flex items-end justify-between">
								<span class="pricetag text-2xl">{fmtBaht(p.price)}<span class="ml-0.5 text-base font-semibold">฿</span></span>
								<div class="text-right">
									<span class="tnum text-xl font-bold" style="color:{barColor}">{p.stock}</span>
									{#if p.unit}<span class="ml-0.5 text-sm text-ink-soft">{p.unit}</span>{/if}
								</div>
							</div>
						</button>

						<!-- Quick stock ± (outside the card body button) -->
						<div class="flex shrink-0 items-center justify-between border-t border-dashed px-3 py-2" style="border-color:var(--color-line)">
							<button
								class="flex h-10 w-10 items-center justify-center rounded-full font-display text-xl font-bold text-ink-soft active:scale-90"
								style="background:var(--color-paper-2)"
								onclick={() => adjustStock(p, -1)}
								disabled={p.stock <= 0 || adjustingId === p.id}
								aria-label="ลดสต๊อก">−</button
							>
							<span class="text-sm font-semibold text-ink-soft">สต๊อก</span>
							<button
								class="flex h-10 w-10 items-center justify-center rounded-full font-display text-xl font-bold text-white active:scale-90"
								style="background:var(--color-forest);box-shadow:0 2px 0 var(--color-forest-ink)"
								onclick={() => adjustStock(p, 1)}
								disabled={adjustingId === p.id}
								aria-label="เพิ่มสต๊อก">+</button
							>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<!-- ฟอร์มเพิ่ม/แก้ไข -->
{#if showForm}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(36,31,23,0.55)"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && (showForm = false)}
	>
		<div class="animate-pop card flex max-h-full w-full max-w-lg flex-col overflow-hidden p-0">
			<div class="bg-ink px-5 py-4 font-display text-xl font-bold text-paper">
				{editingId ? 'แก้ไขสินค้า' : 'เพิ่มสินค้า'}
			</div>
			<div class="space-y-3 overflow-y-auto p-5">
				{#if formError}
					<div class="rounded-xl px-3 py-2 font-medium" style="background:#f0ddd3;color:var(--color-alert-ink)">{formError}</div>
				{/if}
				<label class="block">
					<span class="text-sm font-semibold text-ink-soft">ชื่อสินค้า *</span>
					<input bind:value={f.name} class="field mt-1" />
				</label>
				<label class="block">
					<span class="text-sm font-semibold text-ink-soft">บาร์โค้ด (เว้นว่างได้)</span>
					<input bind:value={f.barcode} inputmode="numeric" class="field mt-1 tnum" oninput={onBarcodeInput} />
				</label>

				<!-- ===== รูปสินค้าอัตโนมัติ ===== -->
				{#if fetchingImage}
					<div class="flex items-center gap-2 text-sm text-ink-soft">
						<span class="animate-spin">⏳</span> กำลังดึงข้อมูล…
					</div>
				{:else if f.image_url}
					<div class="flex items-center gap-3 rounded-2xl p-2" style="background:var(--color-paper-2)">
						<img
							src={f.image_url}
							alt="รูปสินค้า"
							class="h-20 w-20 shrink-0 rounded-xl object-cover"
							loading="lazy"
							onerror={() => (f.image_url = '')}
						/>
						<div class="flex flex-col gap-1.5">
							<span class="text-sm font-semibold" style="color:var(--color-forest)">ดึงข้อมูลสำเร็จ ✓</span>
							<button type="button" class="btn btn-soft px-3 py-1.5 text-sm" onclick={tryFetchImage}>ดึงใหม่</button>
							<button type="button" class="btn btn-ghost px-3 py-1.5 text-sm" style="color:var(--color-alert)"
								onclick={() => { f.image_url = ''; imageNotFound = false; }}>ลบรูป</button>
						</div>
					</div>
				{:else if imageNotFound}
					<div class="flex items-center justify-between rounded-xl px-3 py-2 text-sm" style="background:var(--color-paper-2)">
						<span class="text-ink-soft">ไม่พบข้อมูลใน Open Food Facts</span>
						<button type="button" class="font-semibold" style="color:var(--color-forest)" onclick={tryFetchImage}>ลองใหม่</button>
					</div>
				{/if}

				<div class="grid grid-cols-2 gap-3">
					<label class="block">
						<span class="text-sm font-semibold text-ink-soft">ราคาขาย *</span>
						<input bind:value={f.price} type="number" inputmode="decimal" class="field mt-1 tnum" />
					</label>
					<label class="block">
						<span class="text-sm font-semibold text-ink-soft">ราคาทุน</span>
						<input bind:value={f.cost} type="number" inputmode="decimal" class="field mt-1 tnum" />
					</label>
					<label class="block">
						<span class="text-sm font-semibold text-ink-soft">สต๊อก</span>
						<input bind:value={f.stock} type="number" inputmode="numeric" class="field mt-1 tnum" />
					</label>
					<label class="block">
						<span class="text-sm font-semibold text-ink-soft">หน่วย</span>
						<input bind:value={f.unit} placeholder="ชิ้น/ขวด/กก." class="field mt-1" />
					</label>
					<label class="block col-span-2">
						<span class="text-sm font-semibold text-ink-soft">แจ้งเตือนเมื่อสต๊อกต่ำกว่า</span>
						<input bind:value={f.min_stock} type="number" inputmode="numeric" placeholder="เช่น 5 (เว้นว่างได้)" class="field mt-1 tnum" />
					</label>
				</div>
				<label class="block">
					<span class="text-sm font-semibold text-ink-soft">หมวดหมู่</span>
					<input bind:value={f.category} class="field mt-1" />
				</label>
				<label class="flex items-center gap-2.5 pt-1">
					<input type="checkbox" bind:checked={f.is_active} class="h-6 w-6" style="accent-color:var(--color-forest)" />
					<span class="font-medium text-ink">เปิดขาย</span>
				</label>
			</div>
			<div class="grid gap-2.5 border-t-2 border-dashed border-line p-3" style="grid-template-columns: 1fr 1fr {editingId ? '1fr' : ''}">
				<button class="btn btn-soft py-3 text-lg" onclick={() => (showForm = false)}>ยกเลิก</button>
				{#if editingId}
					{@const currentP = items.find(p => p.id === editingId)}
					{#if currentP}
						<button class="btn py-3 text-lg" style="background:#f0ddd3;color:var(--color-alert-ink);box-shadow:0 3px 0 #e8c4b0" onclick={() => remove(currentP)}>🗑 ลบ</button>
					{/if}
				{/if}
				<button class="btn btn-success py-3 text-lg" onclick={submit}>บันทึก</button>
			</div>
		</div>
	</div>
{/if}

<!-- ตั้งค่า -->
{#if showSettings}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		style="background: rgba(36,31,23,0.55)"
		role="presentation"
		onclick={(e) => e.target === e.currentTarget && (showSettings = false)}
	>
		<div class="animate-pop card w-full max-w-md overflow-hidden p-0">
			<div class="bg-ink px-5 py-4 font-display text-xl font-bold text-paper">ตั้งค่าร้าน</div>
			<div class="space-y-3 p-5">
				<label class="block">
					<span class="text-sm font-semibold text-ink-soft">ชื่อร้าน</span>
					<input bind:value={sShopName} class="field mt-1" />
				</label>
				<label class="block">
					<span class="text-sm font-semibold text-ink-soft">เบอร์พร้อมเพย์ / เลขบัตรประชาชน (สำหรับ QR)</span>
					<input bind:value={sPromptpay} inputmode="numeric" placeholder="08xxxxxxxx" class="field mt-1 tnum" />
				</label>
				<label class="block">
					<span class="text-sm font-semibold text-ink-soft">Line Notify Token</span>
					<input bind:value={sLineToken} placeholder="วางโทเค็นจาก notify-bot.line.me" class="field mt-1" />
					<a href="https://notify-bot.line.me/my/" target="_blank" rel="noopener" class="mt-1 block text-xs" style="color:var(--color-forest)">→ สร้าง token ที่ notify-bot.line.me</a>
				</label>
			</div>
			<div class="grid grid-cols-2 gap-2.5 border-t-2 border-dashed border-line p-3">
				<button class="btn btn-soft py-3 text-lg" onclick={() => (showSettings = false)}>ยกเลิก</button>
				<button class="btn btn-success py-3 text-lg" onclick={saveSettings}>บันทึก</button>
			</div>
		</div>
	</div>
{/if}

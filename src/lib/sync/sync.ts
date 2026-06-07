import { writable } from 'svelte/store';
import { db } from '$lib/db/schema';
import { getSupabase, isCloudEnabled } from './supabase';
import { getCurrentUser } from '$lib/stores/auth';
import { loadCatalog } from '$lib/stores/catalog';

export const syncStatus = writable<{ pending: number; error: boolean }>({ pending: 0, error: false });

let running = false;

// ─── Sales sync (push unsynced bills) ─────────────────────────────

export async function syncPendingSales(): Promise<{ pushed: number; skipped: boolean }> {
	if (running) return { pushed: 0, skipped: true };
	const supabase = getSupabase();
	if (!supabase) return { pushed: 0, skipped: true };

	const user = getCurrentUser();
	if (!user) return { pushed: 0, skipped: true };

	running = true;
	let pushed = 0;
	try {
		const pending = await db.sales.where('synced').equals(0).toArray();
		syncStatus.set({ pending: pending.length, error: false });

		for (const sale of pending) {
			const items = await db.sale_items.where('sale_id').equals(sale.id).toArray();

			const { error: saleErr } = await supabase.from('sales').upsert({
				id: sale.id,
				created_at: new Date(sale.created_at).toISOString(),
				total: sale.total,
				payment_method: sale.payment_method,
				cash_received: sale.cash_received ?? null,
				change: sale.change ?? null,
				status: sale.status ?? 'completed',
				voided_at: sale.voided_at ? new Date(sale.voided_at).toISOString() : null,
				void_reason: sale.void_reason ?? null,
				user_id: user.id
			});
			if (saleErr) throw saleErr;

			if (items.length) {
				const { error: itemErr } = await supabase.from('sale_items').upsert(
					items.map((i) => ({
						id: i.id,
						sale_id: i.sale_id,
						product_id: i.product_id,
						name: i.name,
						price: i.price,
						qty: i.qty,
						subtotal: i.subtotal,
						user_id: user.id
					}))
				);
				if (itemErr) throw itemErr;
			}

			await db.sales.update(sale.id, { synced: 1 });
			pushed++;
			syncStatus.set({ pending: pending.length - pushed, error: false });
		}
		syncStatus.set({ pending: 0, error: false });
	} catch (err) {
		console.warn('[sync] push failed, will retry:', err);
		const count = await pendingSyncCount();
		syncStatus.set({ pending: count, error: true });
	} finally {
		running = false;
	}
	return { pushed, skipped: false };
}

// ─── Products sync (push ALL products including inactive) ─────────

export async function syncProducts(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase) return;
	const user = getCurrentUser();
	if (!user) return;

	try {
		const allProducts = await db.products.toArray();
		if (!allProducts.length) return;

		// Push ทุกสินค้า (รวม inactive) เพื่อให้เครื่องอื่นรับข้อมูลครบ
		const { error } = await supabase.from('products').upsert(
			allProducts.map((p) => ({
				id: p.id,
				barcode: p.barcode,
				name: p.name,
				price: p.price,
				cost: p.cost ?? null,
				stock: p.stock,
				min_stock: p.min_stock ?? null,
				category: p.category ?? null,
				unit: p.unit ?? null,
				is_active: p.is_active,
				image_url: p.image_url ?? null,
				updated_at: new Date(p.updated_at).toISOString(),
				user_id: user.id
			}))
		);
		if (error) console.warn('[sync] product push failed:', error);
	} catch (err) {
		console.warn('[sync] product sync error:', err);
	}
}

// ─── Products pull (always pull + merge by updated_at / LWW) ──────

/**
 * ดึงสินค้าจาก cloud แล้ว merge กับ local ด้วย Last-Write-Wins (updated_at)
 * - สินค้าที่ cloud ใหม่กว่า → update local
 * - สินค้าที่ local ใหม่กว่า → skip (จะ push กลับตอน syncProducts)
 * - สินค้าที่ local ไม่มี → insert
 */
export async function pullProducts(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase) return;
	const user = getCurrentUser();
	if (!user) return;

	try {
		const { data, error } = await supabase
			.from('products')
			.select('*')
			.eq('user_id', user.id);
		if (error || !data?.length) return;

		// สร้าง map ของ local products สำหรับเทียบ updated_at
		const localProducts = await db.products.toArray();
		const localMap = new Map<string, number>();
		for (const p of localProducts) {
			localMap.set(p.id, p.updated_at);
		}

		// กรองเฉพาะสินค้าที่ cloud ใหม่กว่า หรือ local ไม่มี
		const toUpsert = data.filter((cloudProduct) => {
			const localUpdatedAt = localMap.get(cloudProduct.id);
			if (localUpdatedAt === undefined) return true; // local ไม่มี → insert
			const cloudTs = new Date(cloudProduct.updated_at).getTime();
			return cloudTs > localUpdatedAt; // cloud ใหม่กว่า → update
		});

		if (toUpsert.length > 0) {
			await db.products.bulkPut(
				toUpsert.map((p) => ({
					id: p.id,
					barcode: p.barcode ?? null,
					name: p.name,
					price: Number(p.price),
					cost: p.cost != null ? Number(p.cost) : undefined,
					stock: Number(p.stock),
					min_stock: p.min_stock != null ? Number(p.min_stock) : undefined,
					category: p.category ?? undefined,
					unit: p.unit ?? undefined,
					is_active: Number(p.is_active),
					image_url: p.image_url ?? undefined,
					updated_at: new Date(p.updated_at).getTime()
				}))
			);
		}
	} catch (err) {
		console.warn('[sync] product pull failed:', err);
	}
}

// ─── Sales pull (always pull + merge — skip existing) ─────────────

/**
 * ดึงบิลจาก cloud แล้ว merge กับ local
 * บิลเป็น append-only → ถ้า local มีอยู่แล้วก็ skip
 * ยกเว้นบิลที่ voided ต้อง update status
 */
export async function pullSales(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase) return;
	const user = getCurrentUser();
	if (!user) return;

	try {
		const { data: salesData, error: salesError } = await supabase
			.from('sales')
			.select('*')
			.eq('user_id', user.id);
		if (salesError || !salesData?.length) return;

		// สร้าง map ของ local sales
		const localSales = await db.sales.toArray();
		const localSaleMap = new Map<string, { status: string; created_at: number }>();
		for (const s of localSales) {
			localSaleMap.set(s.id, { status: s.status, created_at: s.created_at });
		}

		// แยกบิลใหม่ (local ไม่มี) และบิลที่ต้อง update (voided status เปลี่ยน)
		const newSales = salesData.filter((s) => !localSaleMap.has(s.id));
		const updatedSales = salesData.filter((s) => {
			const local = localSaleMap.get(s.id);
			if (!local) return false;
			// ถ้า cloud เป็น voided แต่ local ยังเป็น completed → update
			return s.status === 'voided' && local.status !== 'voided';
		});

		// Insert บิลใหม่
		if (newSales.length > 0) {
			await db.sales.bulkPut(
				newSales.map((s) => ({
					id: s.id,
					created_at: new Date(s.created_at).getTime(),
					total: Number(s.total),
					payment_method: s.payment_method,
					cash_received: s.cash_received != null ? Number(s.cash_received) : undefined,
					change: s.change != null ? Number(s.change) : undefined,
					status: s.status ?? 'completed',
					voided_at: s.voided_at ? new Date(s.voided_at).getTime() : undefined,
					void_reason: s.void_reason ?? undefined,
					synced: 1
				}))
			);

			// ดึง sale_items ของบิลใหม่
			const newSaleIds = newSales.map((s) => s.id);
			// ดึงทีละ chunk เพราะ Supabase .in() มี limit
			const chunkSize = 100;
			for (let i = 0; i < newSaleIds.length; i += chunkSize) {
				const chunk = newSaleIds.slice(i, i + chunkSize);
				const { data: itemsData, error: itemsError } = await supabase
					.from('sale_items')
					.select('*')
					.in('sale_id', chunk);
				if (itemsError || !itemsData?.length) continue;

				await db.sale_items.bulkPut(
					itemsData.map((it) => ({
						id: it.id,
						sale_id: it.sale_id,
						product_id: it.product_id ?? null,
						name: it.name,
						price: Number(it.price),
						qty: Number(it.qty),
						subtotal: Number(it.subtotal)
					}))
				);
			}
		}

		// Update บิลที่ voided
		if (updatedSales.length > 0) {
			for (const s of updatedSales) {
				await db.sales.update(s.id, {
					status: 'voided',
					voided_at: s.voided_at ? new Date(s.voided_at).getTime() : undefined,
					void_reason: s.void_reason ?? undefined,
					synced: 1
				});
			}
		}
	} catch (err) {
		console.warn('[sync] sale pull failed:', err);
	}
}

// ─── Full Sync (push → pull → reload) ────────────────────────────

let fullSyncRunning = false;

/**
 * Full sync: push local ขึ้น cloud ก่อน แล้ว pull จาก cloud ลงมา merge
 * เรียกตอน login / bootstrap / periodic sync
 * ลำดับ push-first ทำให้ข้อมูล local ไม่หาย
 */
export async function fullSync(): Promise<void> {
	if (fullSyncRunning) return;
	const supabase = getSupabase();
	if (!supabase) return;
	const user = getCurrentUser();
	if (!user) return;

	fullSyncRunning = true;
	try {
		// 1) Push สินค้า local ขึ้น cloud (ป้องกันข้อมูลหาย)
		await syncProducts();

		// 2) Push บิลที่ยังไม่ sync
		await syncPendingSales();

		// 3) Pull สินค้าจาก cloud + merge (LWW)
		await pullProducts();

		// 4) Pull บิลจาก cloud + merge
		await pullSales();

		// 5) รีโหลด catalog ใน memory
		await loadCatalog();
	} catch (err) {
		console.warn('[sync] fullSync error:', err);
	} finally {
		fullSyncRunning = false;
	}
}

/**
 * Periodic sync — เรียกทุก 60 วินาที
 * push ก่อน pull เสมอ เพื่อให้ข้อมูลล่าสุดจากเครื่องนี้ขึ้น cloud ก่อน
 */
export async function periodicSync(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase) return;
	const user = getCurrentUser();
	if (!user) return;

	try {
		await syncProducts();
		await syncPendingSales();
		await pullProducts();
		await pullSales();
		// รีโหลด catalog เฉพาะเมื่อมีข้อมูลเปลี่ยน
		await loadCatalog();
	} catch (err) {
		console.warn('[sync] periodic sync error:', err);
	}
}

// ─── Legacy exports (backward compat) ────────────────────────────

/** @deprecated ใช้ pullProducts() แทน */
export const pullProductsIfEmpty = pullProducts;

/** @deprecated ใช้ pullSales() แทน */
export const pullSalesIfEmpty = pullSales;

export async function pendingSyncCount(): Promise<number> {
	return db.sales.where('synced').equals(0).count();
}

export { isCloudEnabled };

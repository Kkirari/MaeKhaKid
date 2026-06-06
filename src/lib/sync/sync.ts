import { writable } from 'svelte/store';
import { db } from '$lib/db/schema';
import { getSupabase, isCloudEnabled } from './supabase';
import { getCurrentUser } from '$lib/stores/auth';

export const syncStatus = writable<{ pending: number; error: boolean }>({ pending: 0, error: false });

let running = false;

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

export async function syncProducts(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase) return;
	const user = getCurrentUser();
	if (!user) return;

	try {
		const products = await db.products.where('is_active').equals(1).toArray();
		if (!products.length) return;
		const { error } = await supabase.from('products').upsert(
			products.map((p) => ({
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

export async function pullProductsIfEmpty(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase) return;
	const user = getCurrentUser();
	if (!user) return;

	const localCount = await db.products.count();
	if (localCount > 0) return;

	try {
		const { data, error } = await supabase
			.from('products')
			.select('*')
			.eq('user_id', user.id);
		if (error || !data?.length) return;

		await db.products.bulkPut(
			data.map((p) => ({
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
	} catch (err) {
		console.warn('[sync] product pull failed:', err);
	}
}

export async function pullSalesIfEmpty(): Promise<void> {
	const supabase = getSupabase();
	if (!supabase) return;
	const user = getCurrentUser();
	if (!user) return;

	const localCount = await db.sales.count();
	if (localCount > 0) return;

	try {
		const { data: salesData, error: salesError } = await supabase
			.from('sales')
			.select('*')
			.eq('user_id', user.id);
		if (salesError || !salesData?.length) return;

		const { data: itemsData, error: itemsError } = await supabase
			.from('sale_items')
			.select('*')
			.eq('user_id', user.id);
		if (itemsError) return;

		await db.sales.bulkPut(
			salesData.map((s) => ({
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

		if (itemsData?.length) {
			await db.sale_items.bulkPut(
				itemsData.map((i) => ({
					id: i.id,
					sale_id: i.sale_id,
					product_id: i.product_id ?? null,
					name: i.name,
					price: Number(i.price),
					qty: Number(i.qty),
					subtotal: Number(i.subtotal)
				}))
			);
		}
	} catch (err) {
		console.warn('[sync] sale pull failed:', err);
	}
}

export async function pendingSyncCount(): Promise<number> {
	return db.sales.where('synced').equals(0).count();
}

export { isCloudEnabled };

import { db } from '$lib/db/schema';
import { getSupabase, isCloudEnabled } from './supabase';

let running = false;

export async function syncPendingSales(): Promise<{ pushed: number; skipped: boolean }> {
	if (running) return { pushed: 0, skipped: true };
	const supabase = getSupabase();
	if (!supabase) return { pushed: 0, skipped: true };

	running = true;
	let pushed = 0;
	try {
		const pending = await db.sales.where('synced').equals(0).toArray();
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
				void_reason: sale.void_reason ?? null
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
						subtotal: i.subtotal
					}))
				);
				if (itemErr) throw itemErr;
			}

			await db.sales.update(sale.id, { synced: 1 });
			pushed++;
		}
	} catch (err) {
		console.warn('[sync] push failed, will retry:', err);
	} finally {
		running = false;
	}
	return { pushed, skipped: false };
}

export async function pendingSyncCount(): Promise<number> {
	return db.sales.where('synced').equals(0).count();
}

export { isCloudEnabled };

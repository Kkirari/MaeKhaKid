import { db, newId, type Sale, type SaleItem } from './schema';
import type { CartLine } from '$lib/stores/cart';

export interface CompletedSale {
	sale: Sale;
	items: SaleItem[];
}

export interface CheckoutPayload {
	lines: CartLine[];
	total: number;
	payment_method: 'cash' | 'promptpay';
	cash_received?: number;
	change?: number;
}

/**
 * บันทึกบิล + ตัดสต๊อก ภายใน transaction เดียว (atomic)
 * ทุกอย่างเขียนลง IndexedDB ทันที ไม่รอเน็ต
 */
export async function createSale(payload: CheckoutPayload): Promise<CompletedSale> {
	const saleId = newId();
	const now = Date.now();

	const sale: Sale = {
		id: saleId,
		created_at: now,
		total: payload.total,
		payment_method: payload.payment_method,
		cash_received: payload.cash_received,
		change: payload.change,
		status: 'completed',
		synced: 0
	};

	const items: SaleItem[] = payload.lines.map((line) => ({
		id: newId(),
		sale_id: saleId,
		product_id: line.product_id,
		name: line.name,
		price: line.price,
		qty: line.qty,
		subtotal: Math.round(line.price * line.qty * 100) / 100
	}));

	await db.transaction('rw', db.sales, db.sale_items, db.products, async () => {
		await db.sales.add(sale);
		await db.sale_items.bulkAdd(items);

		// ตัดสต๊อกเฉพาะรายการที่ผูกกับสินค้าจริง
		for (const line of payload.lines) {
			if (!line.product_id) continue;
			const product = await db.products.get(line.product_id);
			if (product) {
				if (product.stock < line.qty) {
					throw new Error('สต๊อกไม่พอ: ' + line.name);
				}
				await db.products.update(line.product_id, {
					stock: product.stock - line.qty,
					updated_at: now
				});
			}
		}
	});

	return { sale, items };
}

/**
 * ยกเลิกบิล + คืนสต๊อก ภายใน transaction เดียว (atomic)
 * บิลที่ voided จะถูกกรองออกจากสรุปยอด
 */
export async function voidSale(saleId: string, reason?: string): Promise<void> {
	const now = Date.now();
	await db.transaction('rw', db.sales, db.sale_items, db.products, async () => {
		const sale = await db.sales.get(saleId);
		if (!sale || sale.status === 'voided') return;

		// คืนสต๊อก
		const items = await db.sale_items.where('sale_id').equals(saleId).toArray();
		for (const item of items) {
			if (!item.product_id) continue;
			const product = await db.products.get(item.product_id);
			if (product) {
				await db.products.update(item.product_id, {
					stock: product.stock + item.qty,
					updated_at: now
				});
			}
		}

		// อัปเดตสถานะบิล + mark ให้ sync ใหม่
		await db.sales.update(saleId, {
			status: 'voided',
			voided_at: now,
			void_reason: reason ?? '',
			synced: 0
		});
	});
}

export interface DailySummary {
	date: string;
	count: number;
	total: number;
	cashTotal: number;
	promptpayTotal: number;
	profit: number | null;
	sales: Sale[];
}

function dayBounds(date: Date): { start: number; end: number } {
	const start = new Date(date);
	start.setHours(0, 0, 0, 0);
	const end = new Date(start);
	end.setDate(end.getDate() + 1);
	return { start: start.getTime(), end: end.getTime() };
}

/** สรุปยอดของวันที่กำหนด (ดีฟอลต์ = วันนี้) — ไม่รวมบิลที่ยกเลิก */
export async function getDailySummary(date: Date = new Date()): Promise<DailySummary> {
	const { start, end } = dayBounds(date);
	const allSales = await db.sales
		.where('created_at')
		.between(start, end, true, false)
		.reverse()
		.toArray();

	// แยกบิลที่ยกเลิกออก แต่ยังแสดงในรายการ (เรียงไว้ท้าย)
	const activeSales = allSales.filter((s) => s.status !== 'voided');
	const voidedSales = allSales.filter((s) => s.status === 'voided');
	const sales = [...activeSales, ...voidedSales];

	let total = 0;
	let cashTotal = 0;
	let promptpayTotal = 0;
	for (const s of activeSales) {
		total += s.total;
		if (s.payment_method === 'cash') cashTotal += s.total;
		else promptpayTotal += s.total;
	}

	// คำนวณกำไรจากบิลที่ active เท่านั้น
	let profit: number | null = null;
	if (activeSales.length > 0) {
		const saleIds = activeSales.map((s) => s.id);
		const items = await db.sale_items.where('sale_id').anyOf(saleIds).toArray();
		const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
		const products = await db.products.bulkGet(productIds);
		const costMap = new Map<string, number>();
		for (const p of products) {
			if (p && p.cost != null) costMap.set(p.id, p.cost);
		}
		let hasCost = false;
		let computed = 0;
		for (const item of items) {
			if (item.product_id && costMap.has(item.product_id)) {
				hasCost = true;
				computed += (item.price - costMap.get(item.product_id)!) * item.qty;
			} else {
				computed += item.subtotal;
			}
		}
		profit = hasCost ? Math.round(computed * 100) / 100 : null;
	}

	return {
		date: new Date(start).toISOString().slice(0, 10),
		count: activeSales.length,
		total: Math.round(total * 100) / 100,
		cashTotal: Math.round(cashTotal * 100) / 100,
		promptpayTotal: Math.round(promptpayTotal * 100) / 100,
		profit,
		sales
	};
}

/** ดึงรายการสินค้าในบิล (สำหรับดูรายละเอียด/CSV) */
export async function getSaleItems(saleId: string): Promise<SaleItem[]> {
	return db.sale_items.where('sale_id').equals(saleId).toArray();
}

export interface BestSeller {
	name: string;
	product_id: string | null;
	qty: number;
	revenue: number;
}

/**
 * สินค้าขายดีในช่วงวันที่กำหนด — ไม่รวมบิลที่ยกเลิก
 * ดึงจาก IndexedDB (local) → เร็วพอสำหรับร้านขนาดเล็ก
 */
export async function getBestSellers(
	startDate: Date,
	endDate: Date,
	limit = 10
): Promise<BestSeller[]> {
	const { start } = (() => {
		const s = new Date(startDate);
		s.setHours(0, 0, 0, 0);
		return { start: s.getTime() };
	})();
	const { end } = (() => {
		const e = new Date(endDate);
		e.setHours(23, 59, 59, 999);
		return { end: e.getTime() };
	})();

	const activeSales = await db.sales
		.where('created_at')
		.between(start, end, true, true)
		.filter((s) => s.status !== 'voided')
		.toArray();

	if (activeSales.length === 0) return [];

	const saleIds = activeSales.map((s) => s.id);
	const items = await db.sale_items.where('sale_id').anyOf(saleIds).toArray();

	// รวมยอดต่อสินค้า
	const map = new Map<string, BestSeller>();
	for (const item of items) {
		const key = item.product_id ?? `manual:${item.name}`;
		const existing = map.get(key);
		if (existing) {
			existing.qty += item.qty;
			existing.revenue += item.subtotal;
		} else {
			map.set(key, {
				name: item.name,
				product_id: item.product_id,
				qty: item.qty,
				revenue: Math.round(item.subtotal * 100) / 100
			});
		}
	}

	return [...map.values()]
		.sort((a, b) => b.qty - a.qty)
		.slice(0, limit)
		.map((s) => ({ ...s, revenue: Math.round(s.revenue * 100) / 100 }));
}

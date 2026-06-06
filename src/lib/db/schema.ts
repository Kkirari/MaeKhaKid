import Dexie, { type Table } from 'dexie';

/** สินค้า — barcode เป็น null ได้ (สินค้าไม่มีบาร์โค้ด) */
export interface Product {
	id: string;
	barcode: string | null;
	name: string;
	price: number;
	/** ราคาทุน (ไว้คำนวณกำไร) — ไม่บังคับ */
	cost?: number;
	stock: number;
	/** แจ้งเตือนเมื่อสต๊อกต่ำกว่านี้ — ไม่บังคับ */
	min_stock?: number;
	category?: string;
	/** หน่วยนับ เช่น ชิ้น/ขวด/กก. */
	unit?: string;
	/** 1 = ขายอยู่, 0 = ปิดการขาย (Dexie index ใช้เลขแทน boolean) */
	is_active: number;
	/** URL รูปภาพสินค้า (ดึงจาก Open Food Facts อัตโนมัติ) */
	image_url?: string;
	updated_at: number;
}

/** บิลการขาย 1 ใบ */
export interface Sale {
	id: string;
	created_at: number;
	total: number;
	payment_method: 'cash' | 'promptpay';
	/** เฉพาะจ่ายเงินสด */
	cash_received?: number;
	change?: number;
	/** 'completed' | 'voided' — index ได้ */
	status: 'completed' | 'voided';
	voided_at?: number;
	void_reason?: string;
	/** 0 = ยังไม่ sync ขึ้น cloud, 1 = sync แล้ว (index ได้) */
	synced: number;
}

/** รายการสินค้าในบิล — name/price เป็น snapshot กันราคาเปลี่ยนย้อนหลัง */
export interface SaleItem {
	id: string;
	sale_id: string;
	/** null ได้ สำหรับสินค้าที่กดขายแบบ manual */
	product_id: string | null;
	name: string;
	price: number;
	qty: number;
	subtotal: number;
}

export class PosDatabase extends Dexie {
	products!: Table<Product, string>;
	sales!: Table<Sale, string>;
	sale_items!: Table<SaleItem, string>;

	constructor() {
		super('lukmaekha-pos');

		// v1 — schema เดิม
		this.version(1).stores({
			products: 'id, barcode, name, category',
			sales: 'id, created_at, synced',
			sale_items: 'id, sale_id, product_id'
		});

		// v2 — เพิ่ม min_stock ในสินค้า + status/voided ในบิล
		this.version(2)
			.stores({
				products: 'id, barcode, name, category',
				sales: 'id, created_at, synced, status',
				sale_items: 'id, sale_id, product_id'
			})
			.upgrade(async (tx) => {
				// ตั้ง status='completed' ให้บิลเดิมทุกใบ
				await tx
					.table('sales')
					.toCollection()
					.modify((sale) => {
						if (!sale.status) sale.status = 'completed';
					});
			});
	}
}

export const db = new PosDatabase();

/** ล้างข้อมูลทั้งหมดใน IndexedDB (ใช้ตอน logout หรือ reset) */
export async function clearAllData(): Promise<void> {
	await Promise.all([db.products.clear(), db.sales.clear(), db.sale_items.clear()]);
}

/** สร้าง id แบบ uuid (มี fallback เผื่อ WebView เก่าไม่มี crypto.randomUUID) */
export function newId(): string {
	if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
		return crypto.randomUUID();
	}
	return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

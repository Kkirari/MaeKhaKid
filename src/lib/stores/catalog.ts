import { writable, derived, get } from 'svelte/store';
import type { Product } from '$lib/db/schema';
import { getActiveProducts } from '$lib/db/products';

/** รายการสินค้าที่ขายอยู่ (reactive สำหรับ UI) */
export const products = writable<Product[]>([]);
export const catalogLoaded = writable(false);

/** Map บาร์โค้ด → สินค้า สำหรับค้นหา O(1) ตอนสแกน */
let barcodeMap = new Map<string, Product>();

/** โหลดสินค้าจาก Dexie เข้า memory (เรียกตอนเปิดแอพ และหลังแก้ไขสินค้า) */
export async function loadCatalog(): Promise<void> {
	const list = await getActiveProducts();
	const map = new Map<string, Product>();
	for (const p of list) {
		if (p.barcode) map.set(p.barcode, p);
	}
	barcodeMap = map;
	products.set(list);
	catalogLoaded.set(true);
}

/** ค้นหาสินค้าจากบาร์โค้ดใน memory — เร็วทันทีแม้สินค้าหลายพันรายการ */
export function lookupBarcode(barcode: string): Product | undefined {
	return barcodeMap.get(barcode.trim());
}

/** ค้นหาตามชื่อ (substring, ไม่สนตัวพิมพ์) */
export function searchByName(query: string): Product[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	return get(products)
		.filter((p) => p.name.toLowerCase().includes(q) || (p.barcode ?? '').includes(q))
		.slice(0, 30);
}

/** สินค้าที่สต๊อกต่ำกว่า min_stock (reactive) */
export const lowStockProducts = derived(products, ($products) =>
	$products.filter(
		(p) => p.min_stock != null && p.stock <= p.min_stock && p.is_active === 1
	)
);

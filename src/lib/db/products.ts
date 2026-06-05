import { db, newId, type Product } from './schema';

export type ProductInput = Omit<Product, 'id' | 'updated_at'> & {
	id?: string;
};

/** ดึงสินค้าที่ขายอยู่ทั้งหมด (เรียงตามชื่อ) */
export async function getActiveProducts(): Promise<Product[]> {
	const all = await db.products.toArray();
	return all
		.filter((p) => p.is_active === 1)
		.sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

/** ดึงสินค้าทั้งหมด (รวมที่ปิดการขาย) — สำหรับหน้าจัดการ */
export async function getAllProducts(): Promise<Product[]> {
	const all = await db.products.toArray();
	return all.sort((a, b) => a.name.localeCompare(b.name, 'th'));
}

/** หาสินค้าจากบาร์โค้ด */
export async function findByBarcode(barcode: string): Promise<Product | undefined> {
	return db.products.where('barcode').equals(barcode).first();
}

/** เพิ่ม/แก้ไขสินค้า */
export async function saveProduct(input: ProductInput): Promise<string> {
	const id = input.id ?? newId();
	const product: Product = {
		id,
		barcode: input.barcode?.trim() ? input.barcode.trim() : null,
		name: input.name.trim(),
		price: Number(input.price) || 0,
		cost: input.cost != null && input.cost !== ('' as unknown) ? Number(input.cost) : undefined,
		stock: Number(input.stock) || 0,
		min_stock:
			input.min_stock != null && input.min_stock !== ('' as unknown)
				? Number(input.min_stock)
				: undefined,
		category: input.category?.trim() || undefined,
		unit: input.unit?.trim() || undefined,
		is_active: input.is_active ?? 1,
		image_url: input.image_url?.trim() || undefined,
		updated_at: Date.now()
	};
	await db.products.put(product);
	return id;
}

export async function deleteProduct(id: string): Promise<void> {
	await db.products.delete(id);
}

/** เช็คว่าบาร์โค้ดซ้ำกับสินค้าอื่นไหม */
export async function isBarcodeTaken(barcode: string, exceptId?: string): Promise<boolean> {
	const existing = await db.products.where('barcode').equals(barcode).first();
	return !!existing && existing.id !== exceptId;
}

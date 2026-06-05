export interface BarcodeDetails {
	name?: string;
	brand?: string;
	category?: string;
	image_url?: string;
}

/** ดึงข้อมูลสินค้าจากบาร์โค้ดผ่าน Open Food Facts (ฟรี, ไม่ต้อง API key, รองรับ CORS) */
export async function fetchBarcodeDetails(barcode: string): Promise<BarcodeDetails | null> {
	try {
		const res = await fetch(
			`https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(barcode)}.json`
		);
		if (!res.ok) return null;
		const data = await res.json();
		const p = data?.product;
		if (!p) return null;

		// ชื่อ: ลอง Thai → generic → English
		const name: string | undefined =
			p.product_name_th?.trim() || p.product_name?.trim() || p.product_name_en?.trim() || undefined;

		// แบรนด์
		const brand: string | undefined = p.brands?.split(',')[0]?.trim() || undefined;

		// หมวด: เอาชื่อแรกจาก categories_tags ตัดคำนำหน้า "en:" / "th:"
		const rawCat: string | undefined = p.categories_tags?.[0] ?? p.main_category_en;
		const category = rawCat
			? rawCat.replace(/^[a-z]{2}:/, '').replace(/-/g, ' ')
			: undefined;

		// รูป
		const image_url: string | undefined =
			p.image_thumb_url ?? p.image_small_url ?? p.image_url ?? undefined;

		if (!name && !image_url) return null; // ไม่มีข้อมูลที่เป็นประโยชน์เลย
		return { name, brand, category, image_url };
	} catch {
		return null; // เน็ตหลุด / ไม่พบ — ไม่ขึ้น error
	}
}

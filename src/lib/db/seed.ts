import { db, newId, type Product } from './schema';

/** สินค้าตัวอย่างสำหรับทดสอบ (มีบาร์โค้ดและไม่มีบาร์โค้ดปนกัน) */
const SAMPLES: Array<Omit<Product, 'id' | 'updated_at'>> = [
	{ barcode: '8850999320014', name: 'มาม่า หมูสับ', price: 7, cost: 5.5, stock: 50, category: 'บะหมี่', unit: 'ซอง', is_active: 1 },
	{ barcode: '8851019120016', name: 'น้ำเปล่า สิงห์ 600ml', price: 10, cost: 6, stock: 100, category: 'เครื่องดื่ม', unit: 'ขวด', is_active: 1 },
	{ barcode: '8852000300010', name: 'โค้ก 325ml', price: 14, cost: 10, stock: 60, category: 'เครื่องดื่ม', unit: 'กระป๋อง', is_active: 1 },
	{ barcode: '8858891302017', name: 'เลย์ คลาสสิค', price: 20, cost: 15, stock: 40, category: 'ขนม', unit: 'ถุง', is_active: 1 },
	{ barcode: '8850329112011', name: 'นมตราหมี UHT', price: 12, cost: 9, stock: 36, category: 'เครื่องดื่ม', unit: 'กล่อง', is_active: 1 },
	{ barcode: '8851123201018', name: 'ปลากระป๋อง สามแม่ครัว', price: 22, cost: 17, stock: 30, category: 'อาหารกระป๋อง', unit: 'กระป๋อง', is_active: 1 },
	{ barcode: '8850123456019', name: 'ไข่ไก่ เบอร์ 2 (แผง)', price: 110, cost: 95, stock: 15, category: 'ไข่', unit: 'แผง', is_active: 1 },
	{ barcode: '8859000110015', name: 'ผงซักฟอก บรีส 800g', price: 55, cost: 45, stock: 20, category: 'ของใช้', unit: 'ถุง', is_active: 1 },
	{ barcode: '8850777012013', name: 'ยาสีฟัน คอลเกต', price: 38, cost: 30, stock: 25, category: 'ของใช้', unit: 'หลอด', is_active: 1 },
	{ barcode: '8851959142010', name: 'กาแฟ เนสกาแฟ 3in1', price: 6, cost: 4.5, stock: 80, category: 'เครื่องดื่ม', unit: 'ซอง', is_active: 1 },
	// สินค้าไม่มีบาร์โค้ด (กดจากกริด)
	{ barcode: null, name: 'ถุงพลาสติก', price: 2, cost: 1, stock: 500, category: 'ของใช้', unit: 'ใบ', is_active: 1 },
	{ barcode: null, name: 'น้ำแข็ง (ถุงเล็ก)', price: 10, cost: 6, stock: 40, category: 'เครื่องดื่ม', unit: 'ถุง', is_active: 1 },
	{ barcode: null, name: 'กล้วยน้ำว้า (หวี)', price: 25, cost: 18, stock: 10, category: 'ผลไม้', unit: 'หวี', is_active: 1 },
	{ barcode: null, name: 'ไข่ไก่ (ฟอง)', price: 4, cost: 3.2, stock: 200, category: 'ไข่', unit: 'ฟอง', is_active: 1 },
	{ barcode: null, name: 'พริกขี้หนู (ขีด)', price: 8, cost: 5, stock: 50, category: 'ผัก', unit: 'ขีด', is_active: 1 }
];

/** ใส่ข้อมูลตัวอย่างเฉพาะตอน DB ว่าง */
export async function seedIfEmpty(): Promise<boolean> {
	const count = await db.products.count();
	if (count > 0) return false;
	const now = Date.now();
	const rows: Product[] = SAMPLES.map((s) => ({ ...s, id: newId(), updated_at: now }));
	await db.products.bulkAdd(rows);
	return true;
}

import { writable, derived } from 'svelte/store';
import type { Product } from '$lib/db/schema';

export interface CartLine {
	/** key ภายในตะกร้า (ต่างจาก product id เพื่อรองรับ manual line) */
	key: string;
	product_id: string | null;
	name: string;
	price: number;
	qty: number;
}

function createCart() {
	const { subscribe, update, set } = writable<CartLine[]>([]);

	return {
		subscribe,

		/** เพิ่มสินค้าจาก catalog (ถ้ามีอยู่แล้วเพิ่มจำนวน) */
		addProduct(product: Product, qty = 1) {
			update((lines) => {
				const existing = lines.find((l) => l.product_id === product.id);
				if (existing) {
					existing.qty += qty;
					return [...lines];
				}
				return [
					...lines,
					{
						key: product.id,
						product_id: product.id,
						name: product.name,
						price: product.price,
						qty
					}
				];
			});
		},

		/** เพิ่มรายการ manual (เช่น ของไม่มีในระบบ ตั้งราคาเอง) */
		addManual(name: string, price: number, qty = 1) {
			update((lines) => [
				...lines,
				{
					key: 'manual-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
					product_id: null,
					name,
					price,
					qty
				}
			]);
		},

		setQty(key: string, qty: number) {
			update((lines) => {
				if (qty <= 0) return lines.filter((l) => l.key !== key);
				return lines.map((l) => (l.key === key ? { ...l, qty } : l));
			});
		},

		setPrice(key: string, price: number) {
			update((lines) => lines.map((l) => (l.key === key ? { ...l, price } : l)));
		},

		remove(key: string) {
			update((lines) => lines.filter((l) => l.key !== key));
		},

		clear() {
			set([]);
		}
	};
}

export const cart = createCart();

/** ยอดรวมและจำนวนชิ้น */
export const cartTotals = derived(cart, ($cart) => {
	let total = 0;
	let count = 0;
	for (const line of $cart) {
		total += line.price * line.qty;
		count += line.qty;
	}
	return {
		total: Math.round(total * 100) / 100,
		count,
		lineCount: $cart.length
	};
});

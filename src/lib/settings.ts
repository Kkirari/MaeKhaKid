import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Settings {
	shopName: string;
	/** เบอร์พร้อมเพย์ หรือเลขบัตรประชาชน สำหรับสร้าง QR */
	promptpayId: string;
	/** Line Notify token สำหรับส่งรายงานวันละครั้ง */
	lineNotifyToken: string;
	/** true = ผ่าน onboarding แล้ว */
	onboarded: boolean;
	/** true = โหมดทดสอบ — seed ข้อมูลตัวอย่างอัตโนมัติ */
	devMode: boolean;
	/** รายการ ID สินค้าที่พินไว้ */
	pinnedProductIds: string[];
	/** โหมดการแสดงผลในหน้าแรก (all = แสดงทั้งหมดโดยพินอยู่บนสุด, pinned = แสดงเฉพาะที่พิน) */
	pinMode: 'all' | 'pinned';
	/** UI Scale (percentage, default 100) */
	uiScale: number;
}

const DEFAULTS: Settings = {
	shopName: 'ลูกแม่ค้า',
	promptpayId: '',
	lineNotifyToken: '',
	onboarded: false,
	devMode: false,
	pinnedProductIds: [],
	pinMode: 'all',
	uiScale: 100
};

let currentKey = 'lukmaekha-settings';

function load(key: string): Settings {
	if (!browser) return DEFAULTS;
	try {
		const raw = localStorage.getItem(key);
		if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		// ignore
	}
	return DEFAULTS;
}

function createSettings() {
	const { subscribe, set, update } = writable<Settings>(load(currentKey));

	return {
		subscribe,
		save(next: Partial<Settings>) {
			update((s) => {
				const merged = { ...s, ...next };
				if (browser) localStorage.setItem(currentKey, JSON.stringify(merged));
				return merged;
			});
		},
		set,
		loadForUser(userId: string | null) {
			currentKey = userId ? `lukmaekha-settings-${userId}` : 'lukmaekha-settings';
			set(load(currentKey));
		}
	};
}

export const settings = createSettings();

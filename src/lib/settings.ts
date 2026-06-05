import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Settings {
	shopName: string;
	/** เบอร์พร้อมเพย์ หรือเลขบัตรประชาชน สำหรับสร้าง QR */
	promptpayId: string;
	/** Line Notify token สำหรับส่งรายงานวันละครั้ง */
	lineNotifyToken: string;
}

const DEFAULTS: Settings = {
	shopName: 'ลูกแม่ค้า',
	promptpayId: '',
	lineNotifyToken: ''
};

const KEY = 'lukmaekha-settings';

function load(): Settings {
	if (!browser) return DEFAULTS;
	try {
		const raw = localStorage.getItem(KEY);
		if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
	} catch {
		// ignore
	}
	return DEFAULTS;
}

function createSettings() {
	const { subscribe, set, update } = writable<Settings>(load());

	return {
		subscribe,
		save(next: Partial<Settings>) {
			update((s) => {
				const merged = { ...s, ...next };
				if (browser) localStorage.setItem(KEY, JSON.stringify(merged));
				return merged;
			});
		},
		set
	};
}

export const settings = createSettings();

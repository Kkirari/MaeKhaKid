import type { DailySummary, BestSeller } from '$lib/db/sales';
import { fmtBaht } from '$lib/format';
import type { Product } from '$lib/db/schema';

/**
 * ส่งข้อความไปยัง Line Notify (https://notify-api.line.me/api/notify)
 * token ได้จาก https://notify-bot.line.me/my/
 */
export async function sendLineNotify(token: string, message: string): Promise<void> {
	const body = new URLSearchParams({ message });
	const res = await fetch('https://notify-api.line.me/api/notify', {
		method: 'POST',
		headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
		body
	});
	if (!res.ok) {
		const text = await res.text().catch(() => res.status.toString());
		throw new Error(`Line Notify error: ${text}`);
	}
}

/** สร้างข้อความรายงานประจำวัน (ใช้ส่งไป Line) */
export function buildDailyReport(
	summary: DailySummary,
	shopName: string,
	bestSellers: BestSeller[],
	lowStock: Product[]
): string {
	const lines: string[] = [];
	const thDate = new Date(summary.date + 'T00:00:00').toLocaleDateString('th-TH', {
		weekday: 'short',
		day: 'numeric',
		month: 'short',
		year: 'numeric'
	});

	lines.push(`🧺 ${shopName}`);
	lines.push(`📅 ${thDate}`);
	lines.push('');
	lines.push(`💰 ยอดรวม: ${fmtBaht(summary.total)} ฿`);
	lines.push(`📋 จำนวนบิล: ${summary.count} ใบ`);
	lines.push(`💵 เงินสด: ${fmtBaht(summary.cashTotal)} ฿`);
	lines.push(`📱 พร้อมเพย์: ${fmtBaht(summary.promptpayTotal)} ฿`);
	if (summary.profit != null) {
		lines.push(`📈 กำไรโดยประมาณ: ${fmtBaht(summary.profit)} ฿`);
	}

	if (bestSellers.length > 0) {
		lines.push('');
		lines.push('🏆 สินค้าขายดี');
		bestSellers.slice(0, 5).forEach((s, i) => {
			lines.push(`${i + 1}. ${s.name} — ${s.qty} ชิ้น (${fmtBaht(s.revenue)} ฿)`);
		});
	}

	if (lowStock.length > 0) {
		lines.push('');
		lines.push('⚠️ สต๊อกต่ำ');
		lowStock.slice(0, 8).forEach((p) => {
			lines.push(`• ${p.name}: เหลือ ${p.stock}${p.unit ? ' ' + p.unit : ''}`);
		});
	}

	return lines.join('\n');
}

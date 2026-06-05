const baht = new Intl.NumberFormat('th-TH', {
	minimumFractionDigits: 0,
	maximumFractionDigits: 2
});

/** จัดรูปแบบเงินบาท เช่น 1,234.5 */
export function fmtBaht(n: number): string {
	return baht.format(Math.round(n * 100) / 100);
}

/** เวลาแบบไทย HH:MM */
export function fmtTime(ts: number): string {
	return new Date(ts).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

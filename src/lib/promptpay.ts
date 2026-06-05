import generatePayload from 'promptpay-qr';
import QRCode from 'qrcode';

/**
 * สร้าง QR พร้อมเพย์เป็น data URL
 * @param target เบอร์พร้อมเพย์ (08x...) หรือเลขบัตรประชาชน
 * @param amount ยอดเงิน (บาท)
 */
export async function promptPayQrDataUrl(target: string, amount: number): Promise<string> {
	const payload = generatePayload(target, { amount });
	return QRCode.toDataURL(payload, { margin: 1, width: 360, errorCorrectionLevel: 'M' });
}

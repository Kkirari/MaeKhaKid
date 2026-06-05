/**
 * เสียงตอบรับด้วย Web Audio (ไม่ต้องโหลดไฟล์เสียง → เบา เร็ว ทำงานออฟไลน์)
 * - beepOk: สแกนติด/เพิ่มสินค้าสำเร็จ
 * - beepError: สแกนไม่เจอ/ผิดพลาด
 */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
	if (typeof window === 'undefined') return null;
	if (!ctx) {
		const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
		if (!Ctor) return null;
		ctx = new Ctor();
	}
	return ctx;
}

function tone(freq: number, durationMs: number, type: OscillatorType = 'square', volume = 0.15) {
	const audio = getCtx();
	if (!audio) return;
	if (audio.state === 'suspended') audio.resume();
	const osc = audio.createOscillator();
	const gain = audio.createGain();
	osc.type = type;
	osc.frequency.value = freq;
	gain.gain.value = volume;
	osc.connect(gain);
	gain.connect(audio.destination);
	const now = audio.currentTime;
	osc.start(now);
	gain.gain.setValueAtTime(volume, now);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + durationMs / 1000);
	osc.stop(now + durationMs / 1000);
}

export function beepOk() {
	tone(880, 90);
}

export function beepError() {
	tone(220, 200, 'sawtooth', 0.2);
}

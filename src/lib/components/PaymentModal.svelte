<script lang="ts">
	import { fmtBaht } from '$lib/format';
	import { promptPayQrDataUrl } from '$lib/promptpay';
	import { settings } from '$lib/settings';
	import { createSale } from '$lib/db/sales';
	import { cart } from '$lib/stores/cart';
	import type { CartLine } from '$lib/stores/cart';
	import { beepOk } from '$lib/sound';

	let {
		total,
		lines,
		onClose,
		onDone
	}: {
		total: number;
		lines: CartLine[];
		onClose: () => void;
		onDone: () => void;
	} = $props();

	let method = $state<'cash' | 'promptpay'>('cash');
	let cashReceived = $state<number | null>(null);
	let qrUrl = $state<string>('');
	let qrError = $state<string>('');
	let saving = $state(false);

	const NOTES = [20, 50, 100, 500, 1000];

	const quickCash = $derived.by(() => {
		const filtered = NOTES.filter((n) => n >= total);
		if (filtered.length > 0) return filtered;
		const base = Math.ceil(total / 1000) * 1000;
		return [base, base + 1000, base + 2000];
	});

	const denomCols = $derived(quickCash.length <= 3 ? 3 : quickCash.length === 4 ? 4 : 3);

	const change = $derived(cashReceived != null ? Math.round((cashReceived - total) * 100) / 100 : null);
	const canPayCash = $derived(cashReceived != null && cashReceived >= total);

	$effect(() => {
		if (method === 'promptpay') generateQr();
	});

	async function generateQr() {
		qrError = '';
		qrUrl = '';
		const id = $settings.promptpayId.trim();
		if (!id) {
			qrError = 'ยังไม่ได้ตั้งเบอร์พร้อมเพย์ (ไปที่ "สินค้า" → ตั้งค่า)';
			return;
		}
		try {
			qrUrl = await promptPayQrDataUrl(id, total);
		} catch (e) {
			qrError = 'สร้าง QR ไม่สำเร็จ: ' + (e as Error).message;
		}
	}

	function setCash(amount: number) {
		cashReceived = amount;
	}
	function exactCash() {
		cashReceived = total;
	}

	async function confirm() {
		if (saving) return;
		saving = true;
		try {
			await createSale({
				lines,
				total,
				payment_method: method,
				cash_received: method === 'cash' ? (cashReceived ?? total) : undefined,
				change: method === 'cash' ? (change ?? 0) : undefined
			});
			beepOk();
			cart.clear();
			onDone();
		} finally {
			saving = false;
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	style="background: rgba(36,31,23,0.55)"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && onClose()}
>
	<div class="animate-pop card flex max-h-full w-full max-w-2xl flex-col overflow-hidden p-0">
		<!-- หัว: ยอดที่ต้องชำระ -->
		<div class="bg-ink px-5 py-3 text-paper">
			<div class="font-display text-sm font-semibold tracking-wide opacity-70">ยอดที่ต้องชำระ</div>
			<div class="font-display text-4xl font-bold tnum text-gold">
				{fmtBaht(total)}<span class="ml-1 text-2xl text-paper">฿</span>
			</div>
		</div>

		<!-- เลือกวิธีจ่าย -->
		<div class="grid grid-cols-2 gap-2 p-2.5">
			<button
				class="btn py-3 text-lg {method === 'cash' ? 'btn-primary' : 'btn-soft'}"
				onclick={() => (method = 'cash')}>💵 เงินสด</button
			>
			<button
				class="btn py-3 text-lg {method === 'promptpay' ? 'btn-primary' : 'btn-soft'}"
				onclick={() => (method = 'promptpay')}>📱 พร้อมเพย์</button
			>
		</div>

		<div class="px-4 pb-2">
			{#if method === 'cash'}
				<input
					id="cash-input"
					type="number"
					inputmode="decimal"
					bind:value={cashReceived}
					placeholder="0"
					class="field mb-2 py-2 text-right font-display text-2xl font-bold tnum"
				/>
				<!-- ธนบัตรที่ครอบคลุมยอด -->
				<div class="mb-2 grid gap-2" style="grid-template-columns: repeat({denomCols}, minmax(0, 1fr))">
					{#each quickCash as amt (amt)}
						<button class="btn btn-soft py-2.5 text-base" onclick={() => setCash(amt)}>
							{fmtBaht(amt)} ฿
						</button>
					{/each}
				</div>
				<div class="mb-2 grid grid-cols-2 gap-2">
					<button
						class="btn py-2.5 text-base"
						style="background: var(--color-sand-soft); color: var(--color-clay-ink); box-shadow: 0 3px 0 var(--color-gold)"
						onclick={exactCash}>พอดี ({fmtBaht(total)})</button
					>
					<button class="btn btn-soft py-2.5 text-base" onclick={() => (cashReceived = null)}>ล้าง</button>
				</div>
				{#if change != null}
					<div
						class="animate-pop rounded-2xl px-4 py-2 text-center font-display text-xl font-bold tnum"
						style={change >= 0
							? 'background: var(--color-paper-2); color: var(--color-forest-ink)'
							: 'background: var(--color-sand-soft); color: var(--color-alert-ink)'}
					>
						{change >= 0 ? 'เงินทอน' : 'ยังขาด'} {fmtBaht(Math.abs(change))} ฿
					</div>
				{/if}
			{:else}
				<div class="flex flex-col items-center py-2">
					{#if qrError}
						<div
							class="rounded-2xl px-4 py-3 text-center font-medium"
							style="background: var(--color-sand-soft); color: var(--color-clay-ink)"
						>
							{qrError}
						</div>
					{:else if qrUrl}
						<div class="rounded-2xl border-2 border-line bg-white p-3">
							<img src={qrUrl} alt="PromptPay QR" class="h-52 w-52" />
						</div>
						<div class="mt-2 text-center text-ink-soft">
							ให้ลูกค้าสแกนจ่าย <span class="pricetag text-lg">{fmtBaht(total)} ฿</span><br />
							<span class="text-sm">เมื่อเงินเข้าแล้วกด "ยืนยันรับเงิน"</span>
						</div>
					{:else}
						<div class="py-12 text-ink-soft">กำลังสร้าง QR…</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ปุ่มล่าง -->
		<div class="grid grid-cols-[1fr_2fr] gap-2 border-t-2 border-dashed border-line p-2.5">
			<button class="btn btn-soft py-3 text-lg" onclick={onClose} disabled={saving}>ยกเลิก</button>
			<button
				class="btn btn-success py-3 text-lg"
				onclick={confirm}
				disabled={saving || (method === 'cash' ? !canPayCash : !!qrError || !qrUrl)}
			>
				{saving ? 'กำลังบันทึก…' : method === 'cash' ? 'รับเงิน + บันทึก' : 'ยืนยันรับเงิน'}
			</button>
		</div>
	</div>
</div>

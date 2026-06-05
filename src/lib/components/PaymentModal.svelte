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

	const quickCash = [20, 50, 100, 500, 1000];

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

	function addQuickCash(amount: number) {
		cashReceived = (cashReceived ?? 0) + amount;
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
		<div class="bg-ink px-6 py-5 text-paper">
			<div class="font-display text-sm font-semibold tracking-wide opacity-70">ยอดที่ต้องชำระ</div>
			<div class="font-display text-5xl font-bold tnum text-gold">
				{fmtBaht(total)}<span class="ml-1 text-3xl text-paper">฿</span>
			</div>
		</div>

		<!-- เลือกวิธีจ่าย -->
		<div class="grid grid-cols-2 gap-2.5 p-3">
			<button
				class="btn py-4 text-xl {method === 'cash' ? 'btn-primary' : 'btn-soft'}"
				onclick={() => (method = 'cash')}>💵 เงินสด</button
			>
			<button
				class="btn py-4 text-xl {method === 'promptpay' ? 'btn-primary' : 'btn-soft'}"
				onclick={() => (method = 'promptpay')}>📱 พร้อมเพย์</button
			>
		</div>

		<div class="overflow-y-auto px-6 pb-2">
			{#if method === 'cash'}
				<label class="mb-1 block text-sm font-semibold text-ink-soft" for="cash-input">รับเงินมา (บาท)</label>
				<input
					id="cash-input"
					type="number"
					inputmode="decimal"
					bind:value={cashReceived}
					placeholder="0"
					class="field mb-3 py-3 text-right font-display text-3xl font-bold tnum"
				/>
				<div class="mb-3 grid grid-cols-3 gap-2">
					{#each quickCash as amt (amt)}
						<button class="btn btn-soft py-3 text-lg" onclick={() => addQuickCash(amt)}>+{amt}</button>
					{/each}
					<button
						class="btn col-span-2 py-3 text-lg"
						style="background: var(--color-sand-soft); color: var(--color-clay-ink); box-shadow: 0 3px 0 var(--color-gold)"
						onclick={exactCash}>พอดี ({fmtBaht(total)})</button
					>
					<button class="btn btn-soft py-3 text-lg" onclick={() => (cashReceived = null)}>ล้าง</button>
				</div>
				{#if change != null}
					<div
						class="animate-pop rounded-2xl px-4 py-3 text-center font-display text-2xl font-bold tnum"
						style={change >= 0
							? 'background: #e2e8d4; color: var(--color-forest-ink)'
							: 'background: #f0ddd3; color: var(--color-alert-ink)'}
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
							<img src={qrUrl} alt="PromptPay QR" class="h-60 w-60" />
						</div>
						<div class="mt-3 text-center text-ink-soft">
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
		<div class="grid grid-cols-[1fr_2fr] gap-2.5 border-t-2 border-dashed border-line p-3">
			<button class="btn btn-soft py-4 text-xl" onclick={onClose} disabled={saving}>ยกเลิก</button>
			<button
				class="btn btn-success py-4 text-xl"
				onclick={confirm}
				disabled={saving || (method === 'cash' ? !canPayCash : !!qrError || !qrUrl)}
			>
				{saving ? 'กำลังบันทึก…' : method === 'cash' ? 'รับเงิน + บันทึก' : 'ยืนยันรับเงิน'}
			</button>
		</div>
	</div>
</div>

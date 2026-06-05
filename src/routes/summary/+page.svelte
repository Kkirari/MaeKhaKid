<script lang="ts">
	import { onMount } from 'svelte';
	import {
		getDailySummary,
		getSaleItems,
		voidSale,
		getBestSellers,
		type DailySummary,
		type BestSeller
	} from '$lib/db/sales';
	import { lowStockProducts } from '$lib/stores/catalog';
	import { fmtBaht, fmtTime } from '$lib/format';
	import { pendingSyncCount, syncPendingSales, isCloudEnabled } from '$lib/sync/sync';
	import { sendLineNotify, buildDailyReport } from '$lib/notify';
	import { settings } from '$lib/settings';

	function todayStr(): string {
		const d = new Date();
		d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
		return d.toISOString().slice(0, 10);
	}

	let dateStr = $state(todayStr());
	let summary = $state<DailySummary | null>(null);
	let bestSellers = $state<BestSeller[]>([]);
	let pending = $state(0);
	let syncing = $state(false);
	let sending = $state(false);
	let sendResult = $state('');
	let showBestSellers = $state(true);
	let voidingId = $state<string | null>(null);
	const cloud = isCloudEnabled();

	async function load() {
		const [y, m, d] = dateStr.split('-').map(Number);
		const date = new Date(y, m - 1, d);
		const end = new Date(y, m - 1, d);
		[summary, bestSellers, pending] = await Promise.all([
			getDailySummary(date),
			getBestSellers(date, end),
			pendingSyncCount()
		]);
	}

	async function doSync() {
		syncing = true;
		await syncPendingSales();
		await load();
		syncing = false;
	}

	async function doVoid(saleId: string) {
		if (!confirm('ยืนยันยกเลิกบิลนี้? สต๊อกจะถูกคืนกลับ')) return;
		voidingId = saleId;
		try {
			await voidSale(saleId, 'ยกเลิกโดยผู้ขาย');
			await load();
		} finally {
			voidingId = null;
		}
	}

	async function doSendLine() {
		const token = $settings.lineNotifyToken.trim();
		if (!token || !summary) return;
		sending = true;
		sendResult = '';
		try {
			const msg = buildDailyReport(summary, $settings.shopName, bestSellers, $lowStockProducts);
			await sendLineNotify(token, msg);
			sendResult = 'ส่งสำเร็จ ✓';
		} catch (e) {
			sendResult = 'ส่งไม่สำเร็จ: ' + (e as Error).message;
		} finally {
			sending = false;
			setTimeout(() => (sendResult = ''), 4000);
		}
	}

	async function exportCsv() {
		if (!summary || summary.sales.length === 0) return;
		const rows: string[] = ['เวลา,สถานะ,วิธีจ่าย,สินค้า,ราคา,จำนวน,รวม'];
		for (const sale of summary.sales) {
			const items = await getSaleItems(sale.id);
			const method = sale.payment_method === 'cash' ? 'เงินสด' : 'พร้อมเพย์';
			const status = sale.status === 'voided' ? 'ยกเลิก' : 'สำเร็จ';
			for (const it of items) {
				const name = '"' + it.name.replace(/"/g, '""') + '"';
				rows.push(`${fmtTime(sale.created_at)},${status},${method},${name},${it.price},${it.qty},${it.subtotal}`);
			}
		}
		rows.push('', `รวมทั้งวัน,,,,,"${summary.total}"`);
		const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ยอดขาย-${summary.date}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	onMount(load);
</script>

<div class="flex h-full flex-col p-3">
	<!-- ===== หัว ===== -->
	<div class="mb-3 flex flex-wrap items-center gap-2">
		<h1 class="font-display text-2xl font-bold text-ink">สรุปยอด</h1>
		<input type="date" bind:value={dateStr} onchange={load} class="field w-auto py-2 tnum" />
		<div class="ml-auto flex flex-wrap items-center gap-2">
			{#if cloud}
				<span
					class="rounded-full px-3 py-1.5 text-sm font-semibold"
					style={pending > 0
						? 'background: var(--color-sand-soft); color: var(--color-clay-ink)'
						: 'background:#e2e8d4; color: var(--color-forest-ink)'}
				>
					{pending > 0 ? `รอ sync ${pending} บิล` : '☁️ sync แล้ว'}
				</span>
				<button class="btn btn-soft py-2" onclick={doSync} disabled={syncing}>{syncing ? '…' : 'sync'}</button>
			{:else}
				<span class="rounded-full bg-paper-2 px-3 py-1.5 text-sm font-semibold text-ink-soft">โหมด local</span>
			{/if}

			<!-- Line Notify -->
			{#if $settings.lineNotifyToken}
				<button
					class="btn btn-soft py-2 text-sm"
					onclick={doSendLine}
					disabled={sending || !summary}
					title="ส่งรายงานไปไลน์"
				>
					{sending ? 'กำลังส่ง…' : '💬 ส่งไลน์'}
				</button>
			{/if}

			<button class="btn btn-primary py-2" onclick={exportCsv}>⬇ CSV</button>
		</div>
	</div>

	{#if sendResult}
		<div
			class="mb-2 animate-pop rounded-2xl px-4 py-2 text-center font-semibold"
			style={sendResult.startsWith('ส่งสำเร็จ')
				? 'background:#e2e8d4;color:var(--color-forest-ink)'
				: 'background:#f0ddd3;color:var(--color-alert-ink)'}
		>
			{sendResult}
		</div>
	{/if}

	{#if summary}
		<!-- ===== การ์ด stat ===== -->
		<div class="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
			<div class="card col-span-2 overflow-hidden bg-ink p-5 text-paper">
				<div class="font-display text-sm font-semibold opacity-70">ยอดขายรวม</div>
				<div class="font-display text-5xl font-bold tnum text-gold">
					{fmtBaht(summary.total)}<span class="ml-1 text-2xl text-paper">฿</span>
				</div>
			</div>
			<div class="card p-4">
				<div class="text-sm text-ink-soft">จำนวนบิล</div>
				<div class="font-display text-4xl font-bold tnum text-ink">{summary.count}</div>
			</div>
			<div class="card flex flex-col justify-center gap-2 p-4">
				<div class="flex items-center justify-between">
					<span class="text-sm text-ink-soft">💵 เงินสด</span>
					<span class="font-display font-bold tnum text-ink">{fmtBaht(summary.cashTotal)}</span>
				</div>
				<div class="flex items-center justify-between">
					<span class="text-sm text-ink-soft">📱 พร้อมเพย์</span>
					<span class="font-display font-bold tnum text-ink">{fmtBaht(summary.promptpayTotal)}</span>
				</div>
			</div>
			{#if summary.profit != null}
				<div
					class="card col-span-2 flex items-center justify-between p-4 sm:col-span-4"
					style="background:#e2e8d4; border-color:#c7d2b0"
				>
					<span class="font-semibold" style="color:var(--color-forest-ink)">กำไรโดยประมาณ (จากราคาทุนที่บันทึก)</span>
					<span class="pricetag text-2xl" style="color:var(--color-forest-ink)">{fmtBaht(summary.profit)} ฿</span>
				</div>
			{/if}
		</div>

		<div class="flex min-h-0 flex-1 gap-3 overflow-hidden">
			<!-- ===== รายการบิล ===== -->
			<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
				<h2 class="mb-2 font-display font-bold text-ink-soft">รายการบิล</h2>
				<div class="flex-1 overflow-y-auto">
					{#each summary.sales as sale, i (sale.id)}
						{@const voided = sale.status === 'voided'}
						<div
							class="card mb-2 flex items-center gap-2 p-3"
							style="animation: rise 0.3s cubic-bezier(0.16,1,0.3,1) both; animation-delay:{Math.min(i * 14, 280)}ms; {voided ? 'opacity:0.55' : ''}"
						>
							<div class="min-w-0 flex-1">
								<div class="flex items-center gap-2">
									<span class="font-display text-lg font-bold tnum text-ink {voided ? 'line-through' : ''}"
										>{fmtTime(sale.created_at)}</span
									>
									<span
										class="rounded-full px-2.5 py-0.5 text-sm font-semibold"
										style="background: var(--color-paper-2); color: var(--color-ink-soft)"
									>
										{sale.payment_method === 'cash' ? '💵 เงินสด' : '📱 พร้อมเพย์'}
									</span>
									{#if voided}
										<span class="rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
											style="background:var(--color-alert)">ยกเลิก</span
										>
									{/if}
								</div>
								{#if voided && sale.void_reason}
									<div class="mt-0.5 text-xs text-ink-soft">{sale.void_reason}</div>
								{/if}
							</div>
							<span class="pricetag text-xl {voided ? 'line-through opacity-50' : ''}"
								>{fmtBaht(sale.total)} ฿</span
							>
							{#if !voided}
								<button
									class="shrink-0 rounded-xl px-2.5 py-2 text-sm font-semibold text-ink-soft active:scale-95"
									style="background:var(--color-paper-2)"
									onclick={() => doVoid(sale.id)}
									disabled={voidingId === sale.id}
									aria-label="ยกเลิกบิล"
								>
									{voidingId === sale.id ? '…' : 'ยกเลิก'}
								</button>
							{/if}
						</div>
					{:else}
						<div class="mt-16 text-center text-ink-soft">
							<div class="text-5xl">🧾</div>
							<div class="mt-2 font-display">ยังไม่มีการขายในวันนี้</div>
						</div>
					{/each}
				</div>
			</div>

			<!-- ===== สินค้าขายดี ===== -->
			{#if bestSellers.length > 0}
				<div class="flex w-64 shrink-0 flex-col overflow-hidden">
					<button
						class="mb-2 flex items-center justify-between font-display font-bold text-ink-soft"
						onclick={() => (showBestSellers = !showBestSellers)}
					>
						<span>🏆 ขายดี</span>
						<span class="text-sm">{showBestSellers ? '▲' : '▼'}</span>
					</button>
					{#if showBestSellers}
						<div class="flex-1 overflow-y-auto">
							{#each bestSellers as s, i (s.name)}
								<div
									class="card mb-2 flex items-center gap-2 p-3"
									style="animation: rise 0.3s cubic-bezier(0.16,1,0.3,1) both; animation-delay:{i * 30}ms"
								>
									<span class="font-display text-lg font-bold tnum" style="color:var(--color-clay); min-width:1.6rem">
										{i + 1}
									</span>
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm font-medium text-ink">{s.name}</div>
										<div class="tnum text-xs text-ink-soft">{s.qty} ชิ้น · {fmtBaht(s.revenue)} ฿</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}

					<!-- สต๊อกต่ำ -->
					{#if $lowStockProducts.length > 0}
						<div class="mt-3">
							<div class="mb-1.5 font-display text-sm font-bold" style="color:#92400e">⚠️ สต๊อกต่ำ</div>
							{#each $lowStockProducts as p (p.id)}
								<div
									class="mb-1 flex items-center justify-between rounded-xl px-3 py-2"
									style="background:#fef3c7; border:1px solid #fcd34d"
								>
									<span class="truncate text-sm font-medium" style="color:#78350f">{p.name}</span>
									<span class="tnum ml-2 shrink-0 text-sm font-semibold" style="color:#92400e"
										>{p.stock}{p.unit ? ' ' + p.unit : ''}</span
									>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<script lang="ts">
	import { settings } from '$lib/settings';
	import { seedIfEmpty } from '$lib/db/seed';
	import { loadCatalog } from '$lib/stores/catalog';

	let { onclose }: { onclose: () => void } = $props();

	let sShopName = $state($settings.shopName);
	let sPromptpay = $state($settings.promptpayId);
	let sLineToken = $state($settings.lineNotifyToken);
	let sDevMode = $state($settings.devMode);
	let sUiScale = $state($settings.uiScale || 100);
	let seeding = $state(false);
	let showToken = $state(false);

	async function save() {
		const wasDevOff = !$settings.devMode;
		settings.save({
			shopName: sShopName.trim() || 'ลูกแม่ค้า',
			promptpayId: sPromptpay.trim(),
			lineNotifyToken: sLineToken.trim(),
			devMode: sDevMode,
			uiScale: sUiScale
		});
		// ถ้าเพิ่งเปิด dev mode → seed ข้อมูลตัวอย่างทันที
		if (sDevMode && wasDevOff) {
			seeding = true;
			await seedIfEmpty();
			await loadCatalog();
			seeding = false;
		}
		onclose();
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center p-4"
	style="background: rgba(36,31,23,0.55)"
	role="presentation"
	onclick={(e) => e.target === e.currentTarget && onclose()}
>
	<div class="animate-pop card w-full max-w-md overflow-hidden p-0">
		<div class="bg-ink px-5 py-4 font-display text-xl font-bold text-paper">ตั้งค่าร้าน</div>

		<div class="space-y-4 p-5">
			<label class="block">
				<span class="text-sm font-semibold text-ink-soft">ชื่อร้าน</span>
				<input bind:value={sShopName} class="field mt-1" />
			</label>

			<label class="block">
				<span class="text-sm font-semibold text-ink-soft">เบอร์พร้อมเพย์ / เลขบัตรประชาชน (สำหรับ QR)</span>
				<input bind:value={sPromptpay} inputmode="numeric" placeholder="08xxxxxxxx" class="field mt-1 tnum" />
			</label>

			<label class="block">
				<span class="text-sm font-semibold text-ink-soft">Line Notify Token</span>
				<div class="relative mt-1 flex items-center">
					<input
						type={showToken ? 'text' : 'password'}
						bind:value={sLineToken}
						placeholder="วางโทเค็นจาก notify-bot.line.me"
						class="field pr-10"
					/>
					<button
						type="button"
						onclick={() => (showToken = !showToken)}
						class="absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-paper-2 text-base transition-colors focus:outline-none"
						style="opacity: {showToken ? '1' : '0.4'}; color: var(--color-ink);"
						aria-label={showToken ? 'ซ่อนโทเค็น' : 'แสดงโทเค็น'}
					>
						👁
					</button>
				</div>
				<a href="https://notify-bot.line.me/my/" target="_blank" rel="noopener"
					class="mt-1 block text-xs" style="color:var(--color-forest)">→ สร้าง token ที่ notify-bot.line.me</a>
			</label>

			<!-- UI Scale Slider -->
			<label class="block rounded-2xl border-2 border-dashed p-4" style="border-color:var(--color-line)">
				<div class="flex items-center justify-between">
					<span class="font-display font-semibold text-ink">ขนาดหน้าจอ (UI Scale)</span>
					<span class="font-display font-bold tnum text-forest">{sUiScale}%</span>
				</div>
				<div class="text-sm text-ink-soft mb-3 mt-1">ปรับให้พอดีกับขนาดหน้าจอของคุณ</div>
				<div class="flex items-center gap-3">
					<span class="text-xl">A-</span>
					<input 
						type="range" 
						min="70" max="150" step="5" 
						bind:value={sUiScale} 
						class="w-full accent-forest" 
					/>
					<span class="text-2xl">A+</span>
				</div>
			</label>

			<!-- Dev Mode -->
			<div class="rounded-2xl border-2 border-dashed p-4" style="border-color:var(--color-line)">
				<label class="flex cursor-pointer items-center justify-between gap-3">
					<div>
						<div class="font-display font-semibold text-ink">Dev Mode</div>
						<div class="text-sm text-ink-soft">เปิดเพื่อเพิ่มสินค้าตัวอย่างอัตโนมัติ (สำหรับทดสอบ)</div>
					</div>
					<!-- toggle switch -->
					<button
						type="button"
						role="switch"
						aria-checked={sDevMode}
						aria-label="เปิด/ปิด Dev Mode"
						onclick={() => (sDevMode = !sDevMode)}
						class="relative h-8 w-14 shrink-0 rounded-full transition-colors"
						style="background:{sDevMode ? 'var(--color-forest)' : 'var(--color-paper-2)'};
						       box-shadow: inset 0 1px 3px rgba(0,0,0,0.2)"
					>
						<span
							class="absolute top-1 h-6 w-6 rounded-full bg-white transition-transform"
							style="left:4px; transform: translateX({sDevMode ? '22px' : '0'});
							       box-shadow: 0 2px 4px rgba(0,0,0,0.25)"
						></span>
					</button>
				</label>
				{#if sDevMode && !$settings.devMode}
					<p class="mt-2 text-xs" style="color:var(--color-forest)">✓ จะเพิ่มสินค้าตัวอย่าง 15 รายการ เมื่อกดบันทึก</p>
				{/if}
			</div>
		</div>

		<div class="grid grid-cols-2 gap-2.5 border-t-2 border-dashed border-line p-3">
			<button class="btn btn-soft py-3 text-lg" onclick={onclose}>ยกเลิก</button>
			<button class="btn btn-success py-3 text-lg" onclick={save} disabled={seeding}>
				{seeding ? 'กำลังโหลด…' : 'บันทึก'}
			</button>
		</div>
	</div>
</div>

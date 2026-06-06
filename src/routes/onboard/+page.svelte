<script lang="ts">
	import { goto } from '$app/navigation';
	import { settings } from '$lib/settings';
	import { seedIfEmpty } from '$lib/db/seed';
	import { loadCatalog } from '$lib/stores/catalog';

	let shopName = $state('');
	let promptpay = $state('');
	let devMode = $state(false);
	let loading = $state(false);

	async function finish() {
		if (!shopName.trim()) return;
		loading = true;
		settings.save({
			shopName: shopName.trim(),
			promptpayId: promptpay.trim(),
			devMode,
			onboarded: true
		});
		if (devMode) {
			await seedIfEmpty();
			await loadCatalog();
		}
		goto('/');
	}
</script>

<div class="flex h-full flex-col items-center justify-center px-6 py-10">
	<div class="card w-full max-w-sm overflow-hidden p-0" style="box-shadow: 0 6px 0 var(--color-line)">
		<!-- header -->
		<div class="bg-forest px-6 py-8 text-center" style="box-shadow: inset 0 -4px 0 var(--color-forest-ink)">
			<span class="text-5xl">🧺</span>
			<div class="mt-3 font-display text-2xl font-bold text-white">ยินดีต้อนรับ!</div>
			<div class="mt-1 font-display text-sm font-semibold tracking-widest text-white/70">
				LUKMAEKHA · POS
			</div>
		</div>

		<!-- form -->
		<div class="space-y-5 p-6">
			<div>
				<p class="font-display font-semibold text-ink">ตั้งค่าร้านของคุณ</p>
				<p class="mt-0.5 text-sm text-ink-soft">ใส่ข้อมูลเพื่อเริ่มต้นใช้งาน</p>
			</div>

			<label class="block">
				<span class="text-sm font-semibold text-ink-soft">ชื่อร้าน *</span>
				<input
					class="field mt-1"
					placeholder="เช่น ร้านยายดา"
					bind:value={shopName}
					required
				/>
			</label>

			<label class="block">
				<span class="text-sm font-semibold text-ink-soft">เบอร์พร้อมเพย์ (ไม่บังคับ)</span>
				<input
					class="field mt-1 tnum"
					inputmode="numeric"
					placeholder="08xxxxxxxx"
					bind:value={promptpay}
				/>
			</label>

			<!-- Dev Mode toggle -->
			<label class="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border-2 border-dashed p-4"
				style="border-color:var(--color-line)">
				<div>
					<div class="font-display text-sm font-semibold text-ink">Dev Mode</div>
					<div class="text-xs text-ink-soft">โหลดสินค้าตัวอย่าง 15 รายการไว้ทดสอบ</div>
				</div>
				<button
					type="button"
					role="switch"
					aria-checked={devMode}
					aria-label="เปิด/ปิด Dev Mode"
					onclick={() => (devMode = !devMode)}
					class="relative h-8 w-14 shrink-0 rounded-full transition-colors"
					style="background:{devMode ? 'var(--color-forest)' : 'var(--color-paper-2)'};
					       box-shadow: inset 0 1px 3px rgba(0,0,0,0.2)"
				>
					<span
						class="absolute top-1 h-6 w-6 rounded-full bg-white transition-transform"
						style="left:4px; transform: translateX({devMode ? '22px' : '0'});
						       box-shadow: 0 2px 4px rgba(0,0,0,0.25)"
					></span>
				</button>
			</label>
		</div>

		<div class="border-t-2 border-dashed border-line px-6 pb-6">
			<button
				class="btn btn-success h-14 w-full text-lg"
				onclick={finish}
				disabled={!shopName.trim() || loading}
			>
				{loading ? 'กำลังตั้งค่า…' : 'เริ่มใช้งาน →'}
			</button>
		</div>
	</div>
</div>

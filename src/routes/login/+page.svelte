<script lang="ts">
	import { goto } from '$app/navigation';
	import { signIn, signUp } from '$lib/stores/auth';
	import { isCloudEnabled } from '$lib/sync/sync';

	let mode = $state<'login' | 'register'>('login');
	let email = $state('');
	let password = $state('');
	let error = $state('');
	let success = $state('');
	let loading = $state(false);

	async function handleSubmit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		success = '';
		loading = true;
		try {
			if (mode === 'login') {
				await signIn(email, password);
			} else {
				await signUp(email, password);
				success = 'สมัครสมาชิกสำเร็จ! กรุณาตรวจสอบอีเมลยืนยัน แล้วเข้าสู่ระบบ';
				mode = 'login';
			}
		} catch (err: unknown) {
			error = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
		} finally {
			loading = false;
		}
	}
</script>

<div class="flex h-full flex-col items-center justify-center px-6">
	<div class="card w-full max-w-sm p-8" style="box-shadow: 0 6px 0 var(--color-line)">
		<!-- โลโก้ -->
		<div class="mb-6 text-center">
			<span
				class="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-forest text-3xl text-white"
				style="box-shadow: 0 4px 0 var(--color-forest-ink)">🧺</span
			>
			<div class="font-display text-2xl font-bold text-ink">ลูกแม่ค้า</div>
			<div class="font-display text-xs font-semibold tracking-widest text-ink-soft">
				LUKMAEKHA · POS
			</div>
		</div>

		{#if isCloudEnabled()}
			<!-- toggle login / register -->
			<div class="mb-5 flex rounded-full border border-line bg-paper p-1">
				<button
					type="button"
					onclick={() => { mode = 'login'; error = ''; success = ''; }}
					class="flex-1 rounded-full py-2 font-display text-sm font-semibold transition-colors
						{mode === 'login' ? 'bg-forest text-white' : 'text-ink-soft'}"
				>เข้าสู่ระบบ</button>
				<button
					type="button"
					onclick={() => { mode = 'register'; error = ''; success = ''; }}
					class="flex-1 rounded-full py-2 font-display text-sm font-semibold transition-colors
						{mode === 'register' ? 'bg-forest text-white' : 'text-ink-soft'}"
				>สมัครสมาชิก</button>
			</div>

			<form onsubmit={handleSubmit} class="flex flex-col gap-4">
				<div class="flex flex-col gap-1.5">
					<label class="font-display text-sm font-semibold text-ink-soft" for="email">อีเมล</label>
					<input
						id="email"
						class="field"
						type="email"
						placeholder="you@example.com"
						bind:value={email}
						required
						autocomplete="email"
					/>
				</div>

				<div class="flex flex-col gap-1.5">
					<label class="font-display text-sm font-semibold text-ink-soft" for="password">รหัสผ่าน</label>
					<input
						id="password"
						class="field"
						type="password"
						placeholder="••••••••"
						bind:value={password}
						required
						autocomplete={mode === 'login' ? 'current-password' : 'new-password'}
					/>
				</div>

				{#if error}
					<p class="rounded-xl bg-alert/10 px-4 py-2.5 text-sm text-alert">{error}</p>
				{/if}
				{#if success}
					<p class="rounded-xl bg-forest/10 px-4 py-2.5 text-sm text-forest">{success}</p>
				{/if}

				<button type="submit" class="btn btn-success mt-2 h-14 text-lg" disabled={loading}>
					{#if loading}
						กำลังดำเนินการ…
					{:else if mode === 'login'}
						เข้าสู่ระบบ
					{:else}
						สมัครสมาชิก
					{/if}
				</button>
			</form>
		{:else}
			<div class="flex flex-col items-center gap-4 text-center">
				<p class="text-sm text-ink-soft">แอพทำงานแบบออฟไลน์เท่านั้น<br />ยังไม่ได้ตั้งค่า Supabase</p>
				<a href="/" class="btn btn-soft h-12 w-full text-base">ใช้งานต่อ (ออฟไลน์)</a>
			</div>
		{/if}
	</div>
</div>

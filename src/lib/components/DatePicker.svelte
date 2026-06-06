<script lang="ts">
	let {
		value = $bindable(),
		onchange
	}: { value: string; onchange?: () => void } = $props();

	let open = $state(false);
	let navYear = $state(0);
	let navMonth = $state(0); // 0-11

	const DAYS_SHORT = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
	const MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
	const MONTHS_FULL = ['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];

	function todayStr() {
		const d = new Date();
		d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
		return d.toISOString().slice(0, 10);
	}

	const today = todayStr();

	$effect(() => {
		const [y, m] = value.split('-').map(Number);
		navYear = y;
		navMonth = m - 1;
	});

	let displayDate = $derived.by(() => {
		const [y, m, d] = value.split('-').map(Number);
		return `${d} ${MONTHS_SHORT[m - 1]} ${y + 543}`;
	});

	let calendarDays = $derived.by(() => {
		const firstDay = new Date(navYear, navMonth, 1).getDay();
		const daysInMonth = new Date(navYear, navMonth + 1, 0).getDate();
		const daysInPrev = new Date(navYear, navMonth, 0).getDate();

		const cells: { date: string; day: number; cur: boolean }[] = [];

		for (let i = firstDay - 1; i >= 0; i--) {
			const d = daysInPrev - i;
			const pm = navMonth === 0 ? 12 : navMonth;
			const py = navMonth === 0 ? navYear - 1 : navYear;
			cells.push({ date: `${py}-${pad(pm)}-${pad(d)}`, day: d, cur: false });
		}
		for (let d = 1; d <= daysInMonth; d++) {
			cells.push({ date: `${navYear}-${pad(navMonth + 1)}-${pad(d)}`, day: d, cur: true });
		}
		const rem = 42 - cells.length;
		for (let d = 1; d <= rem; d++) {
			const nm = navMonth === 11 ? 1 : navMonth + 2;
			const ny = navMonth === 11 ? navYear + 1 : navYear;
			cells.push({ date: `${ny}-${pad(nm)}-${pad(d)}`, day: d, cur: false });
		}
		return cells;
	});

	function pad(n: number) { return String(n).padStart(2, '0'); }

	function prevMonth() {
		if (navMonth === 0) { navMonth = 11; navYear--; } else navMonth--;
	}
	function nextMonth() {
		if (navMonth === 11) { navMonth = 0; navYear++; } else navMonth++;
	}
	function goToday() {
		value = today;
		open = false;
		onchange?.();
	}
	function select(date: string) {
		if (date > today) return;
		value = date;
		open = false;
		onchange?.();
	}
</script>

<div class="date-picker">
	<!-- Trigger -->
	<button
		class="trigger tnum"
		onclick={() => (open = !open)}
		aria-label="เลือกวันที่"
		aria-expanded={open}
	>
		<span class="icon">📅</span>
		{displayDate}
	</button>

	<!-- Backdrop -->
	{#if open}
		<div class="backdrop" role="presentation" onclick={() => (open = false)} onkeydown={() => (open = false)}></div>

		<!-- Calendar popover -->
		<div class="popover animate-pop" role="dialog" aria-label="ปฏิทิน">
			<!-- Month nav -->
			<div class="month-nav">
				<button class="nav-btn" onclick={prevMonth} aria-label="เดือนก่อน">◀</button>
				<span class="month-label font-display">
					{MONTHS_FULL[navMonth]} {navYear + 543}
				</span>
				<button class="nav-btn" onclick={nextMonth} aria-label="เดือนถัดไป">▶</button>
			</div>

			<!-- Day headers -->
			<div class="day-grid">
				{#each DAYS_SHORT as d}
					<div class="day-header">{d}</div>
				{/each}

				<!-- Day cells -->
				{#each calendarDays as cell (cell.date)}
					{@const isSelected = cell.date === value}
					{@const isToday = cell.date === today}
					{@const isFuture = cell.date > today}
					<button
						class="day-cell"
						class:selected={isSelected}
						class:is-today={isToday && !isSelected}
						class:other-month={!cell.cur}
						onclick={() => select(cell.date)}
						tabindex={cell.cur && !isFuture ? 0 : -1}
						disabled={isFuture}
						style={isFuture ? "opacity: 0.4; pointer-events: none; cursor: not-allowed;" : ""}
					>
						{cell.day}
					</button>
				{/each}
			</div>

			<!-- Footer -->
			<div class="footer">
				<button class="today-btn" onclick={goToday}>วันนี้</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.date-picker {
		position: relative;
		display: inline-block;
	}

	.trigger {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.45rem 1rem;
		border-radius: 1rem;
		background: var(--color-card);
		border: 1.5px solid var(--color-line);
		color: var(--color-ink);
		font-family: var(--font-body);
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		box-shadow: 0 3px 0 var(--color-line);
		transition: transform 0.06s ease, box-shadow 0.06s ease;
		white-space: nowrap;
	}
	.trigger:active {
		transform: translateY(3px);
		box-shadow: 0 1px 0 var(--color-line);
	}

	.icon {
		font-size: 1.05rem;
	}

	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 40;
	}

	.popover {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		z-index: 50;
		background: var(--color-card);
		border: 1.5px solid var(--color-line);
		border-radius: 1.25rem;
		box-shadow: 0 6px 0 var(--color-line);
		padding: 0.75rem;
		width: 280px;
	}

	/* Month navigation */
	.month-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 0.6rem;
		gap: 0.25rem;
	}
	.nav-btn {
		width: 36px;
		height: 36px;
		border-radius: 0.75rem;
		background: var(--color-paper-2);
		border: none;
		color: var(--color-ink);
		font-size: 0.85rem;
		font-weight: 700;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: transform 0.06s ease, background-color 0.1s ease;
	}
	.nav-btn:active {
		transform: scale(0.9);
		background: var(--color-forest);
		color: #fff;
	}
	.month-label {
		flex: 1;
		text-align: center;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--color-ink);
	}

	/* Calendar grid */
	.day-grid {
		display: grid;
		grid-template-columns: repeat(7, 1fr);
		gap: 2px;
	}
	.day-header {
		text-align: center;
		font-size: 0.7rem;
		font-weight: 700;
		color: var(--color-ink-soft);
		padding: 4px 0 6px;
	}
	.day-cell {
		aspect-ratio: 1;
		border: none;
		border-radius: 0.6rem;
		background: transparent;
		color: var(--color-ink);
		font-family: var(--font-display);
		font-size: 0.85rem;
		font-weight: 600;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		font-variant-numeric: tabular-nums;
		transition: background-color 0.1s ease, transform 0.06s ease;
		min-height: 36px;
	}
	.day-cell:active {
		transform: scale(0.88);
	}
	.day-cell:hover:not(.selected) {
		background: var(--color-paper-2);
	}
	.day-cell.other-month {
		color: var(--color-ink-soft);
		opacity: 0.4;
	}
	.day-cell.is-today {
		background: var(--color-sand-soft);
		color: var(--color-clay-ink);
		box-shadow: inset 0 0 0 1.5px var(--color-clay);
	}
	.day-cell.selected {
		background: var(--color-forest);
		color: #fff;
		box-shadow: 0 3px 0 var(--color-forest-ink);
	}
	.day-cell.selected:active {
		box-shadow: 0 1px 0 var(--color-forest-ink);
	}

	/* Footer */
	.footer {
		margin-top: 0.6rem;
		display: flex;
		justify-content: center;
	}
	.today-btn {
		padding: 0.3rem 1.2rem;
		border-radius: 99px;
		background: var(--color-paper-2);
		border: none;
		color: var(--color-ink);
		font-family: var(--font-display);
		font-size: 0.8rem;
		font-weight: 700;
		cursor: pointer;
		transition: background-color 0.1s ease, transform 0.06s ease;
	}
	.today-btn:active {
		transform: scale(0.94);
		background: var(--color-sage);
		color: var(--color-forest-ink);
	}
</style>

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## คำสั่งที่ใช้บ่อย
```bash
npm run dev      # dev server (http://localhost:5173)
npm run build    # build static → build/ (adapter-static)
npm run preview  # preview production build
npm run check    # svelte-kit sync + svelte-check (type check) — รันก่อน commit เสมอ
```
ยังไม่มี test runner ในโปรเจค การ verify ทำผ่านการรันแอพจริง (ดู README "วิธีตรวจสอบ")

## บริบทสำคัญ
- โปรเจค POS สำหรับร้านขายของชำ รันบน **แท็บเล็ต Samsung เก่า สเปกต่ำ** → ทุกการตัดสินใจเน้น
  "เร็วบนเครื่องต่ำ" และ UI ต้องเรียบง่ายมากสำหรับผู้ใช้ low-tech (ปุ่มใหญ่ คอนทราสต์สูง ข้อความไทย)
- ภาษาในโค้ดคอมเมนต์/UI เป็น **ภาษาไทย**

## สถาปัตยกรรม (Local-first + Background Sync)
หัวใจคือ **ทุกการอ่าน/เขียนวิ่งเข้า IndexedDB (Dexie) ก่อนเสมอ — ไม่รอเน็ต** ส่วน cloud (Supabase)
เป็นแค่ background sync + backup ดังนั้นเน็ตหลุดก็ขายต่อได้

- **`src/lib/db/`** — แหล่งความจริงตอนใช้งาน (Dexie/IndexedDB)
  - `schema.ts` — นิยาม DB + types (`Product`, `Sale`, `SaleItem`) + `newId()`. boolean เก็บเป็น `number` (0/1) เพื่อให้ Dexie index ได้ (`synced`, `is_active`)
  - `sales.ts` — `createSale()` เขียนบิล + **ตัดสต๊อกใน transaction เดียว (atomic)**; `getDailySummary()` รวมยอด/กำไร
  - `products.ts`, `seed.ts`
- **`src/lib/stores/catalog.ts`** — โหลดสินค้าเข้า **Map ใน memory** ตอนเปิดแอพ → `lookupBarcode()` เป็น O(1)
  เพื่อให้สแกนแล้วขึ้นสินค้าทันทีแม้สินค้าหลายพันรายการ **หลังแก้ไขสินค้าต้องเรียก `loadCatalog()` ใหม่**
- **`src/lib/stores/cart.ts`** — ตะกร้า (custom Svelte store) + `cartTotals` (derived)
- **`src/lib/sync/`** — `supabase.ts` สร้าง client เฉพาะเมื่อมี env (gate ด้วย `$env/dynamic/public`);
  `sync.ts` push บิล `synced=0` ขึ้น cloud แบบ background **ถ้าไม่มี env = no-op เงียบ ๆ** (local-only ยังทำงาน)
- **`src/routes/`** — 3 หน้า: `/` (ขาย/POS), `/products` (CRUD + ตั้งค่าพร้อมเพย์), `/summary` (สรุปยอด)
  `+layout.svelte` ทำ init: `seedIfEmpty()` → `loadCatalog()` → ตั้ง interval sync
- **`src/service-worker.ts`** — SvelteKit native SW (precache app+assets) สำหรับ PWA/ออฟไลน์ (ทำงานเฉพาะ production build)

## ระบบดีไซน์ "ดินตลาด" (Earthtone Market)
นิยามทั้งหมดอยู่ใน `src/app.css` — แก้ที่นั่น อย่า hardcode สีในคอมโพเนนต์
- **พาเลตหลัก (กำหนดโดยผู้ใช้):** `#546B41` เขียวป่า · `#99AD7A` เขียวสาง · `#DCCCAC` ทราย · `#FFF8EC` ครีม
  → map เป็น `@theme` tokens: พื้น `paper`/`card`, ขอบ/ชิป `paper-2`+`line` (ทราย), หมึก `ink`/`ink-soft`
- บทบาทสี: **เขียวป่า** (`forest` = ยืนยัน/ไป → `.btn-success`, แท็บ active, โลโก้, ขอบช่องสแกน),
  **เขียวสาง** (`sage` = ปุ่มรอง → `.btn-primary` เช่น เพิ่มสินค้า/CSV, วิธีจ่ายที่เลือก),
  **ดินเผา/ทอง** (`clay`=ราคา/`.pricetag`, `gold`=ไฮไลต์บนพื้นเข้ม), **ดินเผาแดง** (`alert` = เตือน/ของหมด/ผิดพลาด)
- ฟอนต์: `font-display` = Bai Jamjuree (หัว/ราคา), `font-body` = Anuphan; ตัวเลขใช้คลาส `.tnum`
- คลาส component สำเร็จรูป: `.btn`/`.btn-primary|success|soft|ghost`, `.card`, `.field`, `.tab`, `.pricetag`, `.pager-slider`
- **หน้าขาย (`/`):** แบ่งซ้าย:ขวา = 1:1 (ใบเสร็จ : quick add); กริดสินค้าเป็นหน้า ๆ ละ 3×3 (`PAGE_SIZE=9`)
  เลื่อนแนวนอนด้วย scroll-snap + `<input type=range class=pager-slider>` (sync scrollLeft ↔ currentPage)
- แบรนด์ชื่อ "ลูกแม่ค้า" (ดีฟอลต์ `settings.shopName`); subtitle "LUKMAEKHA · POS"
- **Performance bound (แท็บเล็ตเก่า):** ใช้แอนิเมชัน transform/opacity เท่านั้น + เงาแข็ง (ไม่เบลอ);
  **ห้าม** `backdrop-filter`/blur ใหญ่/แอนิเมตเงา — มันหน่วงบน GPU เก่า
- ปุ่มเป็นทรง "ป้ายราคา" เงาแข็ง (กดแล้ว translateY ลง), ตะกร้าออกแบบเป็น "ใบเสร็จ" (ขอบฟันปลา + เส้นประ)

## ข้อควรระวังเฉพาะโปรเจค
- **SPA mode:** `src/routes/+layout.ts` ตั้ง `ssr = false` (ใช้ IndexedDB/Web API ฝั่ง browser เท่านั้น) +
  adapter-static ใช้ `fallback: 'index.html'` — อย่าเขียนโค้ดที่ต้องรันฝั่ง server
- **บาร์โค้ด nullable:** สินค้าที่ไม่มีบาร์โค้ดเก็บ `barcode: null` — index `barcode` ของ Dexie จะข้าม null ให้เอง
- **บิลเป็น append-only** (ไม่แก้ย้อนหลัง) → sync ไม่ต้องจัดการ conflict ซับซ้อน
- **PromptPay:** QR สร้าง client-side (`src/lib/promptpay.ts`) จาก `settings.promptpayId`; ยืนยันรับเงินแบบ manual
- snapshot `name`/`price` ลงใน `sale_items` กันราคาเปลี่ยนย้อนหลังกระทบบิลเก่า

## Phase 2 additions
- **Dexie v2 migration** — `schema.ts` bumped to version 2; upgrade block backfills `status='completed'`
- **`sales.status`** ('completed'|'voided') + `voided_at` + `void_reason` — voided bills excluded from daily totals; stock restored atomically via `voidSale()` in `db/sales.ts`
- **`products.min_stock`** — optional alert threshold; `lowStockProducts` derived store in `catalog.ts`; alert strip on sales page + amber badge on products page
- **`getBestSellers(start, end, limit)`** in `db/sales.ts` — groups sale_items by product, sorted by qty
- **`src/lib/notify.ts`** — `sendLineNotify(token, msg)` + `buildDailyReport()` message builder; token stored in `settings.lineNotifyToken`
- **`supabase/schema.sql`** updated with v2 ALTER TABLE statements (safe to re-run)

## แผนงาน
แผน Phase ต่าง ๆ และคำแนะนำฮาร์ดแวร์อยู่ที่
`C:\Users\kanki\.claude\plans\barcode-scanner-peaceful-lightning.md`
Phase 1 + Phase 2 เสร็จแล้ว — Phase 3 ถัดไป: ส่วนลด, พิมพ์ใบเสร็จ, ต่อ Supabase จริง

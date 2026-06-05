# LukMaeKha POS 🛒

ระบบ POS (ขายหน้าร้าน) สำหรับร้านขายของชำ — เว็บแอพ PWA แบบ **local-first**
ออกแบบให้เร็วบนแท็บเล็ตเก่า และใช้งานง่ายสำหรับผู้ใช้ที่ไม่ถนัดเทคโนโลยี

## ฟีเจอร์ (Phase 1)
- 📷 **สแกนบาร์โค้ด** ขึ้นสินค้าทันที (รองรับเครื่องสแกน HID/Bluetooth ที่พิมพ์เลข + Enter)
- 🟦 รองรับ **สินค้าไม่มีบาร์โค้ด** (กดจากกริด) + ค้นหาชื่อ
- 🛒 ตะกร้า แก้จำนวน/ลบ คำนวณยอดรวม
- 💵 ชำระ **เงินสด** (คำนวณเงินทอน + ปุ่มลัด) / 📱 **PromptPay QR**
- 📦 บันทึกบิล + **ตัดสต๊อกอัตโนมัติ** (atomic transaction)
- 📊 **สรุปยอดรายวัน** (ยอดรวม/จำนวนบิล/แยกวิธีจ่าย/กำไร) + export CSV
- 📥 จัดการสินค้า (CRUD)
- ☁️ วางโครง **cloud sync** ขึ้น Supabase (background, ออฟไลน์ก็ขายได้)
- 📲 ติดตั้งเป็น PWA ("เพิ่มลงหน้าจอหลัก") + ใช้งานออฟไลน์

## Tech stack
SvelteKit (adapter-static) · Tailwind CSS · Dexie.js (IndexedDB) · Supabase · promptpay-qr · qrcode

## เริ่มใช้งาน
```bash
npm install
npm run dev      # เปิด http://localhost:5173
npm run build    # build เป็น static ในโฟลเดอร์ build/
npm run check    # ตรวจ type
```
ครั้งแรกระบบจะใส่สินค้าตัวอย่างให้ทดสอบอัตโนมัติ

## ตั้งค่า PromptPay
ไปที่หน้า **สินค้า → ⚙️ ตั้งค่า** ใส่เบอร์พร้อมเพย์/เลขบัตรประชาชน
> การยืนยันรับเงิน PromptPay เป็นแบบ manual (ดูเงินเข้าในแอพธนาคารแล้วกดยืนยัน) — ไม่มี payment gateway

## เปิด cloud sync (ทำภายหลังได้)
1. สร้างโปรเจค Supabase แล้วรัน `supabase/schema.sql` ใน SQL Editor
2. คัดลอก `.env.example` เป็น `.env` ใส่ `PUBLIC_SUPABASE_URL` และ `PUBLIC_SUPABASE_ANON_KEY`
3. รีสตาร์ท dev server — บิลจะ sync ขึ้น cloud อัตโนมัติทุก 60 วินาที (ดูสถานะที่หน้าสรุปยอด)

ถ้าไม่ตั้ง env แอพทำงานแบบ local-only ได้ปกติ

## Deploy (Vercel)
build เป็น static site (`build/`) deploy ขึ้น Vercel ได้เลย — โหลดครั้งแรกผ่านเน็ต
แล้ว service worker จะ cache ไว้ใช้งานต่อแบบออฟไลน์

## ฮาร์ดแวร์ที่แนะนำ
เครื่องสแกน 1D ไร้สาย Bluetooth (Netum/Tera/Eyoyo) — ตั้งโหมด HID Keyboard + เติม Enter ต่อท้าย

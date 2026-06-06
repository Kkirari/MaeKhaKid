import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

/**
 * Supabase client — สร้างเฉพาะเมื่อมี env ครบ
 * ตั้งค่าใน .env: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
 * ถ้ายังไม่ตั้ง แอพยังทำงานได้ปกติแบบ local-only
 */
let client: SupabaseClient | null = null;
let initialized = false;

export function getSupabase(): SupabaseClient | null {
	if (initialized) return client;
	initialized = true;
	const url = env.PUBLIC_SUPABASE_URL;
	const key = env.PUBLIC_SUPABASE_ANON_KEY;
	if (url && key) {
		client = createClient(url, key);
	}
	return client;
}

export function isCloudEnabled(): boolean {
	return getSupabase() !== null;
}

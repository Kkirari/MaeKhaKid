import { writable, derived, get } from 'svelte/store';
import type { User } from '@supabase/supabase-js';
import { getSupabase } from '$lib/sync/supabase';

export const authUser = writable<User | null>(null);
export const authLoading = writable(true);
export const isLoggedIn = derived(authUser, ($u) => $u !== null);

export async function initAuth(): Promise<void> {
	const sb = getSupabase();
	if (!sb) {
		authLoading.set(false);
		return;
	}
	const {
		data: { session }
	} = await sb.auth.getSession();
	authUser.set(session?.user ?? null);
	authLoading.set(false);

	sb.auth.onAuthStateChange((_event, session) => {
		authUser.set(session?.user ?? null);
	});
}

export async function signIn(email: string, password: string): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('ไม่ได้ตั้งค่า Supabase');
	const { error } = await sb.auth.signInWithPassword({ email, password });
	if (error) throw error;
}

export async function signUp(email: string, password: string): Promise<void> {
	const sb = getSupabase();
	if (!sb) throw new Error('ไม่ได้ตั้งค่า Supabase');
	const { error } = await sb.auth.signUp({ email, password });
	if (error) throw error;
}

export async function signOut(): Promise<void> {
	const sb = getSupabase();
	if (!sb) return;
	await sb.auth.signOut();
}

export function getCurrentUser(): User | null {
	return get(authUser);
}

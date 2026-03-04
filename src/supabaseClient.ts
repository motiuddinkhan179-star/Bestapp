import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://xoliigbbygwnjuavmjxe.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhvbGlpZ2JieWd3bmp1YXZtanhlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjQwMjQsImV4cCI6MjA4Nzg0MDAyNH0.u1B36D3OJlsTHGfg4--FMHGQ5e3mhFuq6AEs1L8KlPo";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase URL or Anon Key is missing. Please check your environment variables.');
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

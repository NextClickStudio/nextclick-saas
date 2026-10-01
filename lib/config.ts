// Valori pubblici (non segreti) usati sia dal server sia dal browser.

export const APP_NAME = "Yeppo";

// Progetto Supabase "yeppo". La chiave "publishable" è pubblica per definizione:
// serve solo al login. I dati restano protetti dalla Row Level Security.
export const SUPABASE_URL = process.env.SUPABASE_URL || "https://djzzjybrcknrvvovvlpq.supabase.co";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_oZlJY_ee3NtgIqyFpru9ZA_s7_3owj1";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://yeppo.it").replace(/\/+$/, "");

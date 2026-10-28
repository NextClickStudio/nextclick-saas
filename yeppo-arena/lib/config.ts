// Public Supabase values (the anon key is safe to ship: all writes go through the `arena` edge function).
// Hardcoded on purpose: the Vercel project still carries env vars from the previous yeppo app.
export const SUPABASE_URL = "https://djzzjybrcknrvvovvlpq.supabase.co";
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqenpqeWJyY2tucnZ2b3Z2bHBxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMzc3NDgsImV4cCI6MjEwNTgxMzc0OH0.zfGX4ut9qgY04L6tnrxtchpjgf28blV9ISrg7c5rueo";
export const ARENA_FN = `${SUPABASE_URL}/functions/v1/arena`;
export const SITE_URL = "https://yeppo.it";

// yeppo's Discord server: its ids, and the few calls the site makes to Discord as the Yeppo bot (DISCORD_BOT_TOKEN on
// Vercel). The bot has no process of its own: Discord sends the server's button presses to /api/discord.
export const GUILD = "1015622182438699070";
export const ROLE_MEMBER = "1567486969636982886";
export const ROLE_PRO = "1567486968294678638";
export const DISCORD_INVITE = "https://discord.gg/B2cvVw4nSD";
export const INSTAGRAM = "https://instagram.com/getyeppo";
// the application's public key (Discord signs every interaction with it; public by design)
export const PUBLIC_KEY = "759c300816b972246a49bb5d620d9a61d1e960dada3646629e161a88ff0b034a";
export const COLOR = 0xff5fd2;

const TOKEN = process.env.DISCORD_BOT_TOKEN ?? "";

async function call(method: string, path: string, body?: unknown): Promise<Response | null> {
  if (!TOKEN) return null;
  try {
    return await fetch(`https://discord.com/api/v10${path}`, {
      method,
      headers: { authorization: `Bot ${TOKEN}`, "content-type": "application/json", "x-audit-log-reason": "yeppo" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(2500),
    });
  } catch {
    return null;
  }
}

export async function addRole(user: string, role: string): Promise<boolean> {
  const r = await call("PUT", `/guilds/${GUILD}/members/${user}/roles/${role}`);
  return !!r && r.status < 300;
}

export async function removeRole(user: string, role: string): Promise<boolean> {
  const r = await call("DELETE", `/guilds/${GUILD}/members/${user}/roles/${role}`);
  return !!r && (r.status < 300 || r.status === 404);
}

/** a direct message from the bot; a member who closed DMs from server members simply doesn't get it */
export async function dm(user: string, message: unknown): Promise<void> {
  const ch = await call("POST", "/users/@me/channels", { recipient_id: user });
  const id = ch?.ok ? ((await ch.json()) as { id?: string }).id : null;
  if (id) await call("POST", `/channels/${id}/messages`, message);
}

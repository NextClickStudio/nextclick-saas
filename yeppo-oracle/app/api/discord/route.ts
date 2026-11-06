// yeppo.it/api/discord: the Yeppo bot's buttons on the Discord server (the application's interactions endpoint).
//  * "Enter" (#welcome): gives the Member role, which opens the server, and sends a welcome DM with the anti-scam note
//  * "Unlock Pro" (#get-pro): asks for a Pro key; a running key gives the Pro role (the Pro room) and a DM with its end.
//    One key, one Discord account: a key already linked to someone else is refused. The role is taken back when the key
//    runs out (/api/discord/sweep, daily).
// Every request is checked against Discord's signature first.
import { createPublicKey, verify } from "node:crypto";
import { after } from "next/server";
import { DB_HEADERS } from "@/lib/access";
import { SUPABASE_URL } from "@/lib/config";
import { addRole, COLOR, dm, GUILD, INSTAGRAM, PUBLIC_KEY, ROLE_MEMBER, ROLE_PRO } from "@/lib/discord";

export const runtime = "nodejs";

const KEY = createPublicKey({ key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(PUBLIC_KEY, "hex")]), format: "der", type: "spki" });
const PRO_KEY = /^YEP-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}-[0-9A-F]{5}$/;

type Interaction = {
  type: number;
  guild_id?: string;
  member?: { user?: { id: string; username?: string } };
  data?: { custom_id?: string; components?: { components?: { custom_id?: string; value?: string }[] }[] };
};

const reply = (content: string, embed?: Record<string, unknown>) =>
  Response.json({ type: 4, data: { flags: 64, content, embeds: embed ? [embed] : [] } });

const WELCOME_DM = {
  embeds: [
    {
      color: COLOR,
      title: "Welcome to Yeppo 👋",
      description:
        "You're in. Chat, calls and voice rooms are open.\n\n" +
        "**Stay safe.** Nobody from Yeppo will ever DM you first, ask for your seed phrase, your wallet or a payment " +
        "outside yeppo.it. If someone DMs you offering help, signals or a \"support\" link, it's a scam: block and report.\n\n" +
        "**Start here**\n" +
        "• Add the extension: https://yeppo.it/extension\n" +
        "• See every call and what happened next: https://yeppo.it/record\n" +
        "• Plans from 0.2 SOL: https://yeppo.it/pricing\n" +
        `• Instagram: ${INSTAGRAM}`,
      thumbnail: { url: "https://yeppo.it/discord/avatar.png" },
      footer: { text: "Yeppo · find the good coins, skip the traps" },
    },
  ],
};

async function link(user: string, key: string): Promise<{ ok: boolean; why?: string; until?: number } | null> {
  try {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/yr_discord_link`, {
      method: "POST",
      headers: DB_HEADERS,
      body: JSON.stringify({ p_user: user, p_key: key }),
      signal: AbortSignal.timeout(2000),
    });
    return r.ok ? ((await r.json()) as { ok: boolean; why?: string; until?: number }) : null;
  } catch {
    return null;
  }
}

const WHY: Record<string, string> = {
  unknown: "That key doesn't exist. Copy it again from yeppo.it/pricing or from your payment.",
  expired: "That key has expired. Renew it on yeppo.it/pricing: the same key keeps working.",
  taken: "That key is already linked to another Discord account. Write in #help if it's yours.",
};

export async function POST(req: Request) {
  const body = await req.text();
  const sig = req.headers.get("x-signature-ed25519") ?? "";
  const ts = req.headers.get("x-signature-timestamp") ?? "";
  let ok = false;
  try {
    ok = /^[0-9a-f]{128}$/.test(sig) && verify(null, Buffer.from(ts + body), KEY, Buffer.from(sig, "hex"));
  } catch {
    ok = false;
  }
  if (!ok) return new Response("bad signature", { status: 401 });

  const i = JSON.parse(body) as Interaction;
  if (i.type === 1) return Response.json({ type: 1 });
  const user = i.member?.user?.id;
  if (i.guild_id !== GUILD || !user) return reply("This button works on the Yeppo server.");
  const id = i.data?.custom_id ?? "";

  if (i.type === 3 && id === "yeppo:enter") {
    if (!(await addRole(user, ROLE_MEMBER))) return reply("Something went wrong on our side. Try again in a minute.");
    after(() => dm(user, WELCOME_DM));
    return reply("", {
      color: COLOR,
      title: "You're in ✅",
      description: "The whole server is open now: start from **#how-it-works**, then say hi in **#chat**. Check your DMs for the essentials.",
    });
  }

  if (i.type === 3 && id === "yeppo:pro")
    return Response.json({
      type: 9,
      data: {
        custom_id: "yeppo:prokey",
        title: "Unlock the Pro room",
        components: [
          {
            type: 1,
            components: [{ type: 4, custom_id: "key", style: 1, label: "Your Pro key", placeholder: "YEP-XXXXX-XXXXX-XXXXX-XXXXX", min_length: 20, max_length: 40, required: true }],
          },
        ],
      },
    });

  if (i.type === 5 && id === "yeppo:prokey") {
    const key = (i.data?.components?.[0]?.components?.[0]?.value ?? "").trim().toUpperCase();
    if (!PRO_KEY.test(key)) return reply("That doesn't look like a Pro key (YEP-XXXXX-XXXXX-XXXXX-XXXXX).");
    const l = await link(user, key);
    if (!l) return reply("Yeppo can't check keys this second. Try again in a minute.");
    if (!l.ok) return reply(WHY[l.why ?? ""] ?? WHY.unknown);
    const done = await addRole(user, ROLE_PRO);
    await addRole(user, ROLE_MEMBER);
    if (!done) return reply("Your key is fine, but the role didn't stick. Try again in a minute.");
    const end = l.until ? new Date(l.until).toISOString().slice(0, 10) : null;
    after(() =>
      dm(user, {
        embeds: [
          {
            color: COLOR,
            title: "Pro unlocked 💎",
            description: `The Pro room is yours: **#pro-chat**, **#pro-calls** and the Pro voice room.${end ? `\nYour key runs until **${end}**: renew it on yeppo.it/pricing and the room stays open.` : ""}`,
            footer: { text: "Never share your key: it works on one Discord account and 3 devices." },
          },
        ],
      }),
    );
    return reply("", { color: COLOR, title: "Pro unlocked 💎", description: `Welcome to the Pro room.${end ? ` Your key runs until **${end}**.` : ""}` });
  }

  return reply("This button isn't active anymore.");
}

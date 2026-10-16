import { appIcon } from "@/lib/appIcon";

export async function GET(_req: Request, ctx: { params: Promise<{ size: string }> }) {
  const { size } = await ctx.params;
  if (size === "192") return appIcon(192, 14);
  if (size === "512") return appIcon(512, 38);
  if (size === "maskable") return appIcon(512, 110);
  return new Response("Not found", { status: 404 });
}

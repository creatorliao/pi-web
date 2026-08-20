import { NextResponse } from "next/server";
import { patchWebConfig, readWebConfig, type WebConfigAction } from "@/lib/web-config-store";

export const dynamic = "force-dynamic";

const ACTIONS = new Set(["star", "unstar", "hide", "unhide", "resetHidden"]);

function parseAction(body: unknown): WebConfigAction | null {
  if (typeof body !== "object" || body === null) return null;
  const action = (body as { action?: unknown }).action;
  if (typeof action !== "string" || !ACTIONS.has(action)) return null;
  if (action === "resetHidden") return { action: "resetHidden" };
  const key = (body as { key?: unknown }).key;
  if (typeof key !== "string" || !key.trim()) return null;
  return { action, key: key.trim() } as WebConfigAction;
}

export async function GET() {
  const { config } = readWebConfig();
  return NextResponse.json(config);
}

export async function PATCH(req: Request) {
  try {
    const body: unknown = await req.json();
    const patch = parseAction(body);
    if (!patch) {
      return NextResponse.json({ error: "Invalid patch" }, { status: 400 });
    }
    const result = patchWebConfig(patch);
    if (!result.writable) {
      return NextResponse.json({ error: "web.json is unreadable" }, { status: 409 });
    }
    return NextResponse.json(result.config);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

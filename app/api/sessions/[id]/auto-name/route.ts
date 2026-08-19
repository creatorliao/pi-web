import { NextResponse } from "next/server";
import type { AgentSession } from "@earendil-works/pi-coding-agent";
import { generateSessionTitle } from "@/lib/session-title";
import { hasPersistedSessionName, parseAutoNameForce } from "@/lib/session-auto-title";
import { getRpcSession, startRpcSession } from "@/lib/rpc-manager";
import { invalidateSessionListCache, resolveSessionPath } from "@/lib/session-reader";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const force = parseAutoNameForce(await req.text());
    const filePath = await resolveSessionPath(id);
    if (!filePath) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const existing = getRpcSession(id);
    const { session } = existing?.isAlive()
      ? { session: existing }
      : await startRpcSession(id, filePath, undefined);

    // globalThis keeps wrappers alive across dev hot reloads; older instances
    // may predate waitUntilReady(), but those have already completed startup.
    await session.waitUntilReady?.();

    // 自动路径不覆盖已有持久化名（用户手改或先前自动写入）。force 仅按钮重生成。
    const currentName = session.inner.sessionManager.getSessionName();
    if (!force && hasPersistedSessionName(currentName)) {
      return NextResponse.json({ title: currentName!.trim(), usage: null, skipped: true });
    }

    const result = await generateSessionTitle(session.inner as unknown as AgentSession);

    if (!session.isAlive()) {
      return NextResponse.json(
        { error: "The session was closed while its title was being generated. Please try again." },
        { status: 409 },
      );
    }

    // 生成期间用户可能已 PATCH；自动路径再次让步，避免竞态盖掉手工名。
    const nameAfterGenerate = session.inner.sessionManager.getSessionName();
    if (!force && hasPersistedSessionName(nameAfterGenerate)) {
      invalidateSessionListCache();
      return NextResponse.json({ title: nameAfterGenerate!.trim(), usage: null, skipped: true });
    }

    session.inner.setSessionName(result.title);
    invalidateSessionListCache();
    return NextResponse.json({ title: result.title, usage: result.usage ?? null });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

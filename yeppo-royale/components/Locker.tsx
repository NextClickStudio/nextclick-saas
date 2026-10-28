"use client";

import { useEffect, useState } from "react";
import { normLook, type Look } from "@/lib/avatar";
import { confetti, sfx, toast } from "@/lib/fx";
import { rpc } from "@/lib/supabase";
import type { User } from "@/lib/types";
import { useApp } from "./AppProvider";
import Creator from "./Creator";
import TopBar from "./TopBar";

export default function Locker() {
  const { me, session, setMe, openCreator, ready } = useApp();
  const [look, setLook] = useState<Look | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (me && !look) setLook(normLook(me.avatar));
  }, [me, look]);

  const dirty = !!me && !!look && JSON.stringify(normLook(me.avatar)) !== JSON.stringify(look);

  return (
    <>
      <div className="world" />
      <TopBar />
      <main className="page">
        <div className="page-head">
          <h1 className="display">Locker</h1>
          {me && look && (
            <button
              className="btn btn-gold"
              disabled={!dirty || busy}
              onClick={async () => {
                if (!session) return;
                setBusy(true);
                try {
                  const u = await rpc<User>("yr_set_avatar", { p_secret: session.secret, p_avatar: look });
                  setMe(u);
                  sfx.win();
                  confetti();
                  toast("Character saved", "up");
                } catch (e) {
                  toast(e instanceof Error ? e.message : "Could not save", "down");
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Saving…" : dirty ? "Save character" : "Saved"}
            </button>
          )}
        </div>
        {me && look ? (
          <div className="panel">
            <Creator look={look} onChange={setLook} size={240} />
          </div>
        ) : (
          ready && (
            <div className="panel center" style={{ minHeight: 300 }}>
              <div>
                <p className="display" style={{ fontSize: 32 }}>
                  No character yet
                </p>
                <button className="btn btn-gold" style={{ marginTop: 12 }} onClick={() => openCreator(true)}>
                  Create your character
                </button>
              </div>
            </div>
          )
        )}
      </main>
    </>
  );
}

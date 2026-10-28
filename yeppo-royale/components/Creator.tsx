"use client";

import { useState } from "react";
import { PARTS, PART_KEYS, randomLook, type Look, type PartKey } from "@/lib/avatar";
import { sfx } from "@/lib/fx";
import Avatar from "./Avatar";

/** Pick parts for the character; every option is previewed on the character itself. */
export default function Creator({ look, onChange, size = 220 }: { look: Look; onChange: (l: Look) => void; size?: number }) {
  const [part, setPart] = useState<PartKey>("s");
  const spec = PARTS[part];
  return (
    <div className="creator">
      <div className="creator-preview">
        <Avatar look={look} size={size} />
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            sfx.tick();
            onChange(randomLook());
          }}
        >
          🎲 Randomize
        </button>
      </div>
      <div>
        <div className="part-tabs">
          {PART_KEYS.map((k) => (
            <button key={k} className={k === part ? "on" : ""} onClick={() => setPart(k)}>
              {PARTS[k].label}
            </button>
          ))}
        </div>
        <div className="part-grid">
          {spec.names.map((name, i) => {
            const preview = { ...look, [part]: i };
            return (
              <button
                key={name}
                className={look[part] === i ? "on" : ""}
                onClick={() => {
                  sfx.tick();
                  onChange(preview);
                }}
              >
                <Avatar look={preview} size={58} />
                {name}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

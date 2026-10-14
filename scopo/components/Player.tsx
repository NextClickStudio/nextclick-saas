"use client";

import { useEffect, useRef, useState } from "react";
import { loadYouTubeApi, type YTPlayer } from "./youtubeApi";

type Props = {
  videoId: string;
  muted: boolean;
  /** Il browser ha bloccato l'audio: il video riparte muto. */
  onAutoMuted: () => void;
  /** Video rimosso, privato o non incorporabile. */
  onUnavailable: () => void;
};

const PLAYING = 1;
const BUFFERING = 3;

/**
 * Player YouTube senza controlli, a ciclo continuo come su TikTok.
 * Un velo trasparente sopra l'iframe lascia passare lo scroll al feed
 * e trasforma il tocco in play/pausa.
 */
export function Player({ videoId, muted, onAutoMuted, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const mutedRef = useRef(muted);
  const callbacks = useRef({ onAutoMuted, onUnavailable });
  const [paused, setPaused] = useState(false);
  const [started, setStarted] = useState(false);

  mutedRef.current = muted;
  callbacks.current = { onAutoMuted, onUnavailable };

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let cancelled = false;
    let autoplayCheck: ReturnType<typeof setTimeout> | undefined;
    const mount = document.createElement("div");
    host.appendChild(mount);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(mount, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: mutedRef.current ? 1 : 0,
            playsinline: 1,
            controls: 0,
            rel: 0,
            fs: 0,
            disablekb: 1,
            iv_load_policy: 3,
            modestbranding: 1,
          },
          events: {
            onReady: (e) => {
              if (mutedRef.current) e.target.mute();
              else e.target.unMute();
              e.target.playVideo();
              // Se il browser blocca l'autoplay con audio, ripartiamo muti.
              autoplayCheck = setTimeout(() => {
                const state = e.target.getPlayerState();
                if (!cancelled && state !== PLAYING && state !== BUFFERING && !mutedRef.current) {
                  e.target.mute();
                  e.target.playVideo();
                  callbacks.current.onAutoMuted();
                }
              }, 1500);
            },
            onStateChange: (e) => {
              if (e.data === YT.PlayerState.ENDED) {
                e.target.seekTo(0, true);
                e.target.playVideo();
              }
              if (e.data === PLAYING) setStarted(true);
              if (e.data === PLAYING || e.data === YT.PlayerState.PAUSED) {
                setPaused(e.data === YT.PlayerState.PAUSED);
              }
            },
            onError: () => callbacks.current.onUnavailable(),
          },
        });
      })
      .catch(() => {
        if (!cancelled) callbacks.current.onUnavailable();
      });

    return () => {
      cancelled = true;
      clearTimeout(autoplayCheck);
      try {
        playerRef.current?.destroy();
      } catch {
        // il player potrebbe non essere ancora pronto
      }
      playerRef.current = null;
      host.replaceChildren();
    };
  }, [videoId]);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    try {
      if (muted) p.mute();
      else {
        p.unMute();
        p.playVideo();
      }
    } catch {
      // player non pronto: onReady applicherà lo stato giusto
    }
  }, [muted]);

  function togglePlay() {
    const p = playerRef.current;
    if (!p) return;
    if (p.getPlayerState() === PLAYING) p.pauseVideo();
    else p.playVideo();
  }

  return (
    <div className={`player ${started ? "is-started" : ""}`}>
      <div ref={hostRef} className="player-host" />
      <button
        type="button"
        className="player-veil"
        onClick={togglePlay}
        aria-label={paused ? "Play" : "Pause"}
      />
      {paused && (
        <div className="paused-badge" aria-hidden>
          <svg viewBox="0 0 24 24" width="56" height="56">
            <path d="M8 5v14l11-7z" fill="currentColor" />
          </svg>
        </div>
      )}
    </div>
  );
}

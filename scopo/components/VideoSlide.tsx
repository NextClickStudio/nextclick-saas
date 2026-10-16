"use client";

import type { Video } from "@/lib/types";
import { Player } from "./Player";

export function VideoSlide({
  video,
  isActive,
  isNear,
  muted,
  onAutoMuted,
  onUnavailable,
  onToggleMute,
  onOffTopic,
}: {
  video: Video;
  isActive: boolean;
  isNear: boolean;
  muted: boolean;
  onAutoMuted: () => void;
  onUnavailable: () => void;
  onToggleMute: () => void;
  onOffTopic: () => void;
}) {
  return (
    <div className={`video ${isActive ? "is-active" : ""}`}>
      {isNear && (
        <>
          <img className="video-bg" src={video.thumbnail} alt="" aria-hidden />
          <img className="video-thumb" src={video.thumbnail} alt="" aria-hidden />
        </>
      )}
      {isActive && (
        <Player videoId={video.id} muted={muted} onAutoMuted={onAutoMuted} onUnavailable={onUnavailable} />
      )}

      <div className="video-info">
        {video.channel && <p className="video-channel">@{video.channel}</p>}
        <p className="video-title">{video.title}</p>
        {video.reason && (
          <p className="video-reason">
            <span aria-hidden>✦</span> {video.reason}
          </p>
        )}
      </div>

      <div className="rail">
        <button type="button" className="rail-btn" onClick={onToggleMute} aria-label={muted ? "Turn sound on" : "Mute"}>
          {muted ? (
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              <path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
              <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
              <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          )}
          <span>{muted ? "Sound" : "Mute"}</span>
        </button>
        <button type="button" className="rail-btn" onClick={onOffTopic} aria-label="Off-topic, remove it">
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" fill="none" />
            <path d="M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span>Off-topic</span>
        </button>
        <a
          className="rail-btn"
          href={`https://www.youtube.com/shorts/${video.id}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open on YouTube"
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden>
            <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>YouTube</span>
        </a>
      </div>

      {isActive && muted && (
        <button type="button" className="unmute-pill" onClick={onToggleMute}>
          Tap for sound
        </button>
      )}
    </div>
  );
}

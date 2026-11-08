"use client";

// Film 04 · Install. The zip comes down and opens into a folder; the address bar takes chrome://extensions; Developer
// mode switches on; Load unpacked, the folder is picked; yeppo's card appears; it is pinned and its icon sits in the
// toolbar. 15 seconds. (A drawing of the steps, not a copy of the browser's own screens.)
import { at, io, k, mix, out, type Film } from "./engine";
import { Browser, Cursor, Mark } from "./parts";

const WIN = { x: 90, y: 60, w: 1100, h: 680 };

function Scene({ t }: { t: number }) {
  const typed = "chrome://extensions".slice(0, Math.round(mix(0, 19, k(t, 2.6, 3.8, (x) => x))));
  const onPage = t > 4.0;
  const dev = k(t, 5.3, 5.6);
  const picker = k(t, 7.4, 7.9) * (1 - k(t, 9.0, 9.4));
  const card = k(t, 9.4, 10.1);
  const pin = k(t, 11.6, 12.1);
  // the pointer's stops: the download, the address bar, the switch, the button, the folder, the open, the pin
  const stops: [number, number, number][] = [
    [0, 640, 600],
    [1.0, 640, 430],
    [2.3, 420, 82],
    [4.8, 1110, 136],
    [6.8, 172, 186],
    [8.0, 560, 372],
    [8.6, 800, 468],
    [11.0, 1146, 82],
    [13, 1146, 82],
  ];
  let cx = stops[0][1], cy = stops[0][2];
  for (let i = 1; i < stops.length; i++) {
    const [ta, xa, ya] = stops[i - 1], [tb, xb, yb] = stops[i];
    if (t >= ta) {
      const e = io(k(t, ta + (tb - ta) * 0.35, tb, (x) => x));
      cx = mix(xa, xb, e);
      cy = mix(ya, yb, e);
    }
  }
  const zip = k(t, 0.3, 1.0);
  const unzip = k(t, 1.4, 2.0);
  return (
    <div className="fm">
      <Browser x={WIN.x} y={WIN.y} w={WIN.w} h={WIN.h} url={onPage ? "chrome://extensions" : typed || "yeppo.it/extension"} t={t} extIcon={pin > 0.5} iconLit={k(t, 12.1, 12.7)}>
        {!onPage ? (
          <div className="fm-dl">
            <div className="fm-dl-file" style={{ opacity: zip * (1 - unzip), transform: `translateY(${mix(-40, 0, out(zip))}px)` }}>
              <span>ZIP</span>
              yeppo-extension.zip
            </div>
            <div className="fm-dl-folder" style={{ opacity: unzip, transform: `scale(${mix(0.9, 1, out(unzip))})` }}>
              <svg width="64" height="50" viewBox="0 0 64 50" aria-hidden>
                <path d="M2 8 H24 L30 14 H62 V48 H2 Z" fill="none" stroke="#fff" strokeWidth="2" />
              </svg>
              yeppo-extension
            </div>
          </div>
        ) : (
          <div className="fm-ext-page">
            <div className="fm-ext-top">
              <b>Extensions</b>
              <span className="fm-dev">
                Developer mode
                <i className={dev > 0.5 ? "on" : ""}>
                  <em style={{ transform: `translateX(${mix(0, 16, dev)}px)` }} />
                </i>
              </span>
            </div>
            <div className="fm-ext-tools" style={{ opacity: dev, transform: `translateY(${mix(-8, 0, dev)}px)` }}>
              <span className={t > 6.9 && t < 7.4 ? "press" : ""}>Load unpacked</span>
              <span>Pack extension</span>
              <span>Update</span>
            </div>
            <div className="fm-ext-card" style={{ opacity: card, transform: `translateY(${mix(16, 0, out(card))}px)` }}>
              <Mark size={40} />
              <div>
                <b>yeppo 3.5.1</b>
                <span>Reads the Solana memecoin you are looking at.</span>
              </div>
              <i className="on">
                <em style={{ transform: "translateX(16px)" }} />
              </i>
            </div>
          </div>
        )}
      </Browser>
      {/* the folder picker */}
      <div className="fm-pick" style={at(430, 300, { opacity: picker, transform: `scale(${mix(0.96, 1, out(picker))})` })}>
        <b>Select the extension folder</b>
        <div className={`fm-pick-row ${t > 8.0 ? "sel" : ""}`}>
          <svg width="18" height="14" viewBox="0 0 64 50" aria-hidden>
            <path d="M2 8 H24 L30 14 H62 V48 H2 Z" fill="none" stroke="currentColor" strokeWidth="5" />
          </svg>
          yeppo-extension
        </div>
        <span className={`fm-pick-ok ${t > 8.6 && t < 9.0 ? "press" : ""}`}>Select</span>
      </div>
      <div className="fm-pin" style={at(930, 104, { opacity: k(t, 10.8, 11.2) * (1 - k(t, 12.4, 12.8)) })}>
        <Mark size={16} /> yeppo <span>{pin > 0.5 ? "pinned" : "pin"}</span>
      </div>
      <Cursor x={cx} y={cy} t={t} clickAt={[1.05, 2.4, 5.3, 6.95, 8.05, 8.65, 11.6, 12.4]} />
    </div>
  );
}

export const filmInstall: Film = {
  id: "install",
  title: "Install",
  line: "About a minute in Chrome, Brave, Edge or Arc. It never sees your wallet.",
  duration: 15,
  chapters: [
    { at: 0, label: "Download" },
    { at: 2.3, label: "Extensions" },
    { at: 5.0, label: "Developer mode" },
    { at: 6.8, label: "Load" },
    { at: 10.6, label: "Pin" },
  ],
  caption: (t) => (t < 2.3 ? "1 · Download the zip from yeppo.it and open it." : t < 5.0 ? "2 · Go to chrome://extensions." : t < 6.8 ? "3 · Turn on Developer mode." : t < 10.6 ? "4 · Load unpacked, pick the yeppo-extension folder." : t < 14.2 ? "5 · Pin it. Click it on any coin." : ""),
  Scene,
};

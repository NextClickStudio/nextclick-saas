import type { Metadata } from "next";
import Doc from "@/components/Doc";

export const metadata: Metadata = { title: "Privacy · yeppo" };

export default function Page() {
  return (
    <Doc title="Privacy" updated="30 October 2026">
      <p>yeppo is built to know as little about you as possible. There is no account, no email, no name and no card.</p>
      <h2>What yeppo stores</h2>
      <p>
        <b>Public chain data.</b> To work, yeppo reads public Solana data: coins, trades, and the public addresses that made them. This data is
        public on the blockchain for anyone to read.
      </p>
      <p>
        <b>Payments.</b> For a paid plan yeppo keeps the order (plan, amount, time), the transaction signature, the paying address and the license key.
      </p>
      <p>
        <b>In your browser only.</b> The wallet address you guard, your limits, your license key and your settings are saved in your own browser
        (local storage). They are not sent to yeppo, except the wallet address and key when the tool reads them, which it does not store.
      </p>
      <h2>The extension</h2>
      <p>
        The extension reads the address of the coin shown on supported trading sites, and nothing else on the page. It does not read your wallet,
        your keys, your passwords or your history, and it cannot make trades.
      </p>
      <h2>What yeppo does not do</h2>
      <p>No ads, no tracking pixels, no selling of data. Basic server logs (like IP addresses) are kept by the hosting providers for security, for a short time.</p>
      <h2>Your choices</h2>
      <p>Clear your browser&apos;s site data or remove the extension and nothing about you stays on your device.</p>
    </Doc>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import Doc from "@/components/Doc";

export const metadata: Metadata = { title: "Terms · yeppo" };

export default function Page() {
  return (
    <Doc title="Terms of use" updated="30 October 2026">
      <p>
        These terms apply to yeppo: the website at yeppo.it, the yeppo browser extension and everything they show (together, &quot;the
        tool&quot;). By using the tool or paying for a plan you accept them. If you do not accept them, do not use the tool.
      </p>
      <h2>1. What yeppo is</h2>
      <p>
        yeppo is an information tool. It reads public data from the Solana blockchain and shows facts about a memecoin: safety checks, what its
        creator&apos;s earlier coins did, and how it is trading right now, summed up in one word. It does not trade for you, it never holds your funds or keys, and it never asks you to sign
        anything.
      </p>
      <h2>2. Not financial advice</h2>
      <p>
        Nothing yeppo shows is financial, investment, legal or tax advice, or a recommendation to buy, sell or hold anything. Every number comes from
        what past coins did and can be wrong for the coin in front of you. You alone decide your trades and you alone carry their result. Read the{" "}
        <Link href="/risk">risk disclosure</Link> before using the tool.
      </p>
      <h2>3. Who can use it</h2>
      <p>
        You must be at least 18 and allowed to use crypto-asset tools where you live. You are responsible for following the laws that apply to you,
        including any tax on your trades.
      </p>
      <h2>4. Plans and payments</h2>
      <p>
        Paid plans are bought in SOL, sent from your own wallet to yeppo&apos;s wallet. A plan unlocks the tool for the number of days shown at
        checkout, starting when the payment is confirmed on-chain. Plans do not renew by themselves. Blockchain payments cannot be reversed: payments are
        final and not refundable, except where yeppo could not deliver the plan at all because of its own fault. Send the exact amount shown; yeppo
        cannot recover funds sent to a wrong address or on a wrong network.
      </p>
      <p>
        Your license key is the proof of your plan. Keep it private: anyone with the key can use your plan. yeppo may block a key that is shared
        publicly or resold.
      </p>
      <h2>5. Fair use</h2>
      <p>
        Do not copy, scrape or resell yeppo&apos;s data, overload its servers, reverse engineer its private parts, or use it to harm other people. yeppo
        may suspend access that breaks these rules.
      </p>
      <h2>6. Availability and changes</h2>
      <p>
        yeppo depends on public blockchain nodes and third-party sites, which can be slow, wrong or down. The tool is provided as is and as available,
        without any guarantee that it is complete, correct, uninterrupted or fit for a purpose. Features, prices and these terms can change; the date
        above shows the last change, and paid plans already running keep their days.
      </p>
      <h2>7. Limitation of liability</h2>
      <p>
        To the fullest extent the law allows, yeppo is not liable for any loss of funds, profits, data or opportunity, or any indirect damage, arising
        from the use of the tool or from trusting what it shows. In any case, yeppo&apos;s total liability is limited to the amount you paid for the
        plan in the last 30 days.
      </p>
      <h2>8. Third parties</h2>
      <p>
        pump.fun, GMGN, Axiom, Photon, BullX, DexScreener, Birdeye, Jupiter and the wallets you use are run by others. yeppo is not affiliated with them
        and is not responsible for them.
      </p>
    </Doc>
  );
}

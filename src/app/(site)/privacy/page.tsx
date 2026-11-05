import type { Metadata } from "next";
import { Legal } from "../legal";
import { COMPANY, EMAIL, PHONE, UPDATED } from "../site";

export const metadata: Metadata = { title: "Privacy policy", description: "What Oko keeps about you and your farm, why, where, and your rights.", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <Legal title="Privacy policy" updated={UPDATED}>
      <p>Oko is run by <b>{COMPANY}</b> (&ldquo;we&rdquo;). This policy explains what Oko keeps about you and your farm, why, where it is
        kept, who can see it, and your rights under the Nigeria Data Protection Act 2023. In short: <b>your farm records are yours.</b> We
        do not sell them, and nobody outside your workspace sees them unless you invite them.</p>

      <h2>What we keep</h2>
      <ul>
        <li><b>Your account</b>: name, phone number and/or email, and your password (stored only as a one-way hash we cannot read).</li>
        <li><b>Your farm records</b>: everything you and your team enter: sites, houses and ponds, batches, feed, deaths, eggs, weights,
          health cases and treatments, stock, sales, customers, expenses, wages and money accounts.</li>
        <li><b>Photos</b> you add as evidence (for example of sick animals or deliveries).</li>
        <li><b>Your farm&rsquo;s location</b> (state, LGA and, if you add it, map position) to show weather and alerts.</li>
        <li><b>Security and technical records</b>: sign-in sessions, the device and IP address used to sign in, an audit trail of changes,
          and error reports when something breaks (what failed and where, never what you typed).</li>
      </ul>

      <h2>Why we keep it</h2>
      <ul>
        <li>To run Oko for you: show your records, work out costs, profit and alerts, and send the emails you ask for (sign-in codes, invites).</li>
        <li>To keep accounts safe: limit repeated sign-in attempts, record who changed what, and find and fix faults.</li>
        <li>To improve Oko, using totals across farms with no farm or person identified.</li>
      </ul>
      <p>We rely on our contract with you (providing the service you signed up for) and on our legitimate interest in keeping it secure.
        We will ask for your consent before using your records for anything else, such as sharing them with a lender.</p>

      <h2>Who can see it</h2>
      <ul>
        <li><b>People you invite</b> to your workspace, limited by the role and the houses or ponds you give them. Guests such as a vet,
          buyer or lender see only what their role allows, and only until the end date you set.</li>
        <li><b>Oko staff</b>, only to support you or keep the service running, and every action is recorded.</li>
        <li><b>Service providers</b> that run parts of Oko for us, under contract, only for that purpose:
          hosting and database (Render, Vercel and Supabase, in the European Union), file storage and backups (Google Drive),
          email delivery, and weather services (which receive only an approximate location, about 10 km, never your name).</li>
        <li>Authorities, only where Nigerian law requires it.</li>
      </ul>
      <p>We do not sell your data and we do not show advertising.</p>

      <h2>How we protect it</h2>
      <ul>
        <li>Everything travels encrypted (HTTPS). Backups are encrypted before they are stored and are tested by restoring them.</li>
        <li>Your records are separated by workspace, and each person sees only what their role allows.</li>
        <li>On your phone, Oko keeps a copy of your recent records so it works offline. Sign out to remove it from a shared phone.</li>
      </ul>

      <h2>How long we keep it</h2>
      <p>For as long as your account or workspace is open. If you close it, we delete or anonymise your records within 90 days, apart
        from what the law requires us to keep (for example financial records) and encrypted backups, which expire within 30 days.</p>

      <h2>Your rights</h2>
      <p>You can ask to see, correct, download or delete your data, object to or restrict how we use it, and withdraw consent you gave.
        Write to <a href={`mailto:${EMAIL}`}>{EMAIL}</a> or WhatsApp {PHONE}; we reply within 30 days. You can also complain to the
        Nigeria Data Protection Commission.</p>

      <h2>Children</h2>
      <p>Oko is for people aged 18 and over who run or work on farms.</p>

      <h2>Changes</h2>
      <p>If we change this policy in a way that matters, we will tell you in the app or by email before it takes effect.</p>
    </Legal>
  );
}

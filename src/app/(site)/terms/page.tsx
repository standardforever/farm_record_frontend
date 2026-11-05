import type { Metadata } from "next";
import Link from "next/link";
import { Legal } from "../legal";
import { COMPANY, EMAIL, UPDATED } from "../site";

export const metadata: Metadata = { title: "Terms of use", description: "The rules for using Oko.", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <Legal title="Terms of use" updated={UPDATED}>
      <p>These terms are an agreement between you and <b>{COMPANY}</b>, which runs Oko. By creating an account or using Oko you accept
        them. If you use Oko for a farm or business, you accept them for it too.</p>

      <h2>Your account</h2>
      <ul>
        <li>Give true details and keep your password private. You are responsible for what is done with your account.</li>
        <li>The owner of a workspace decides who joins it and what they can see and do, and can remove them at any time.</li>
      </ul>

      <h2>Your records are yours</h2>
      <p>You own what you put into Oko. You let us store and process it only to run Oko for you, as our{" "}
        <Link href="/privacy">privacy policy</Link> explains. You can download it or ask us to delete it.</p>

      <h2>Using Oko fairly</h2>
      <ul>
        <li>Do not enter records you know are false, use Oko to mislead a buyer, lender or authority, or break the law with it.</li>
        <li>Do not try to get into other workspaces, overload the service, or copy or resell Oko.</li>
      </ul>

      <h2>Advice is guidance, not a guarantee</h2>
      <p>Vaccination schedules, growth standards, withdrawal periods, weather alerts and other suggestions in Oko help you decide; they
        do not replace a veterinarian, the medicine label, or your own judgement. Check the label and ask a vet before treating animals
        or selling animals or eggs after treatment.</p>

      <h2>The pilot</h2>
      <p>Oko is free while we run the pilot. Features may change as we learn from you. We will give at least 30 days&rsquo; notice before
        any paid plan applies to you, and you can leave and take your records with you.</p>

      <h2>Availability</h2>
      <p>We work to keep Oko available and your records safe (including nightly tested backups), but we cannot promise it will never be
        interrupted. Oko keeps working offline on your phone and sends your records when the connection returns.</p>

      <h2>Liability</h2>
      <p>To the extent the law allows, Oko is provided &ldquo;as is&rdquo;, and we are not liable for indirect losses such as lost profit or
        animals. Nothing in these terms limits rights you have under Nigerian consumer protection law.</p>

      <h2>Ending</h2>
      <p>You can stop using Oko at any time. We may suspend an account that breaks these terms, and will tell you why where we can.</p>

      <h2>Law and contact</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria. Questions: <a href={`mailto:${EMAIL}`}>{EMAIL}</a>.</p>
    </Legal>
  );
}

import { AccountRow } from "@/components/account-row";
import { BottomNav } from "@/components/bottom-nav";
import { ChevronIcon } from "@/components/icons";

const accounts = [
  { username: "naufal.archive", name: "Naufal", initials: "NA" },
  { username: "studio.senja", name: "Studio Senja", initials: "SS" },
  { username: "rideandgrain", name: "Ride & Grain", initials: "RG" },
];

export default function Home() {
  return (
    <main className="appShell">
      <header className="topBar">
        <div>
          <span className="eyebrow">IG Cleanup</span>
          <h1>Review following</h1>
        </div>
        <button className="avatarButton" type="button" aria-label="Profile">K</button>
      </header>

      <section className="stats" aria-label="Relationship summary">
        <div><strong>1,842</strong><span>Following</span></div>
        <div><strong>1,231</strong><span>Followers</span></div>
        <div><strong>855</strong><span>Not back</span></div>
      </section>

      <button className="importCard" type="button">
        <span className="importIcon">↑</span>
        <span className="importText">
          <strong>Import Instagram data</strong>
          <small>Everything is processed locally on this device.</small>
        </span>
        <ChevronIcon className="chevron" aria-hidden="true" />
      </button>

      <section className="sectionHeader">
        <div>
          <h2>Suggested to review</h2>
          <p>Accounts that do not follow you back</p>
        </div>
        <button type="button">See all</button>
      </section>

      <section className="accountList">
        {accounts.map((account) => <AccountRow key={account.username} {...account} />)}
      </section>

      <p className="disclaimer">IG Cleanup is an independent tool and is not affiliated with Instagram or Meta.</p>
      <BottomNav />
    </main>
  );
}

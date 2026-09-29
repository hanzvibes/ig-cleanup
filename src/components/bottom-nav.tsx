import { BookmarkIcon, HomeIcon, SearchIcon, SparkIcon, UserIcon } from "./icons";

const items = [
  { label: "Home", icon: HomeIcon, active: true },
  { label: "Following", icon: SearchIcon },
  { label: "Cleanup", icon: SparkIcon },
  { label: "Keep", icon: BookmarkIcon },
  { label: "Profile", icon: UserIcon },
];

export function BottomNav() {
  return (
    <nav className="bottomNav" aria-label="Primary navigation">
      {items.map(({ label, icon: Icon, active }) => (
        <button className={active ? "navButton navButtonActive" : "navButton"} type="button" key={label} aria-label={label}>
          <Icon aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

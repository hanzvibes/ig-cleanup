import { BookmarkIcon, HomeIcon, SearchIcon, SparkIcon, UserIcon } from "./icons";

export type AppView = "home" | "following" | "cleanup" | "keep" | "profile";

type BottomNavProps = {
  active: AppView;
  onChange: (view: AppView) => void;
};

const items: Array<{ label: string; view: AppView; icon: typeof HomeIcon }> = [
  { label: "Home", view: "home", icon: HomeIcon },
  { label: "Following", view: "following", icon: SearchIcon },
  { label: "Cleanup", view: "cleanup", icon: SparkIcon },
  { label: "Keep", view: "keep", icon: BookmarkIcon },
  { label: "Profile", view: "profile", icon: UserIcon },
];

export function BottomNav({ active, onChange }: BottomNavProps) {
  return (
    <nav className="bottomNav" aria-label="Primary navigation">
      {items.map(({ label, view, icon: Icon }) => (
        <button
          className={active === view ? "navButton navButtonActive" : "navButton"}
          type="button"
          key={view}
          aria-label={label}
          aria-current={active === view ? "page" : undefined}
          onClick={() => onChange(view)}
        >
          <Icon aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

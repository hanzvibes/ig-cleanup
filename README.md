# IG Cleanup

A mobile-first, local-first assistant for reviewing Instagram relationship data without relying on private Instagram APIs or automating follow/unfollow actions.

## Product direction

- Native-mobile interaction language inspired by modern social apps.
- Import Instagram data exports and process them locally in the browser.
- Review `Following`, `Followers`, `Mutual`, and `Not following back` groups.
- Keep List for accounts the user wants to preserve.
- Open an account in Instagram so the user can make the final unfollow decision themselves.
- No Instagram password storage.
- No browser automation, private endpoints, or unofficial unfollow API.

## Stack

- Next.js App Router
- React + TypeScript
- CSS with system-native typography
- PWA-ready manifest
- Local-first data layer
- Vercel-friendly deployment

## Architecture

```text
src/
├─ app/                    # routes, global UI shell and metadata
├─ components/             # shared visual components
├─ features/
│  └─ instagram-data/      # import/parse/compare domain logic
└─ lib/                    # small shared utilities only
```

The feature layer owns Instagram export parsing and relationship comparison. UI components remain presentation-focused so a later persistence adapter can be introduced without rewriting the interface.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validation

```bash
npm run typecheck
npm run lint
npm run build
```

## Roadmap

1. Implement Instagram export ZIP/JSON import.
2. Normalize follower/following formats across export versions.
3. Build native-feeling Following and Cleanup lists.
4. Add Keep List stored locally.
5. Add account review bottom sheet and Instagram deep links.
6. Add import history and local data reset.
7. Polish accessibility, motion and PWA install experience.
8. Add optional official Meta OAuth only where the official API provides useful supported capabilities.

## Disclaimer

IG Cleanup is an independent third-party project and is not affiliated with, endorsed by, or sponsored by Instagram or Meta.

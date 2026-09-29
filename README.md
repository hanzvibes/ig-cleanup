# IG Cleanup

A mobile-first, local-first assistant for reviewing Instagram relationship exports without relying on private Instagram APIs or automating follow/unfollow actions.

## What works now

- Import an Instagram export as ZIP, JSON, or HTML.
- Parse segmented follower files such as `followers_1.json`, `followers_2.json`, and matching following files.
- Compare Followers, Following, Mutual, and Not Following Back.
- Search and filter the Following list.
- Keep List for accounts that should stay out of the cleanup queue.
- Native-feeling review bottom sheet.
- Open a selected profile in Instagram for the final user-controlled action.
- Persist the latest relationship snapshot and Keep List in browser storage when available.
- Light/dark mode, reduced-motion support, safe-area spacing, and PWA metadata.

The app does **not** store an Instagram password, call private relationship endpoints, or automate unfollow requests.

## Stack

- Next.js App Router
- React + TypeScript
- JSZip for client-side ZIP parsing
- Local browser storage
- GitHub Actions CI
- Vercel-friendly deployment

## Architecture

```text
src/
├─ app/
│  ├─ page.tsx
│  ├─ layout.tsx
│  └─ globals.css
├─ components/
│  ├─ cleanup-app.tsx
│  ├─ home-view.tsx
│  ├─ list-view.tsx
│  ├─ settings-view.tsx
│  ├─ review-sheet.tsx
│  ├─ account-row.tsx
│  ├─ bottom-nav.tsx
│  └─ icons.tsx
└─ features/
   └─ instagram-data/
      ├─ parser.ts
      ├─ compare.ts
      ├─ storage.ts
      └─ types.ts
```

The relationship domain stays separate from the UI so persistence can later move to IndexedDB without rewriting the interface.

## Run locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm run typecheck
npm run lint
npm run build
```

## Next milestones

1. IndexedDB persistence for very large exports.
2. Reviewed-account state and optional review history.
3. Import preview and export-version diagnostics.
4. PWA install/offline polish.
5. E2E tests for import, filters, Keep List, and review sheet.

## Disclaimer

IG Cleanup is an independent third-party project and is not affiliated with, endorsed by, or sponsored by Instagram or Meta.

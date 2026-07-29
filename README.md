# Game Night Library

A public, GitHub-backed board game inventory that helps groups find a game by player count,
time, complexity, mood, mechanics, accessibility needs, and house preferences. When several
games fit, a transparent weighted roulette makes the final choice.

The intended site is `https://bahbus.github.io/BoardGameInventory/`.

## How it works

- `data/inventory.yaml` is the canonical ownership record.
- Games absent from BGG use a stable slug, public source URL, and complete local player/time/age
  values. The application never invents a BGG ID.
- BoardGameGeek metadata is fetched only in trusted GitHub Actions builds and is packaged into
  the Pages artifact; it is not committed.
- The browser performs filtering, scoring, and roulette draws locally.
- Catalog maintenance forms prefill GitHub Issues. Authorized requests can produce reviewable
  pull requests, but nothing merges automatically.

## Local development

Requires Node.js 22 or newer.

```sh
npm install
npm run dev
```

An empty inventory builds without credentials. A production deployment containing BGG-linked items requires an
approved BoardGameGeek application token in `BGG_API_TOKEN`.

Useful checks:

```sh
npm run check
npm run test:e2e
npm run lighthouse
npm run inventory:validate
```

## Import the initial collection

Copy `data/inventory.example.csv`, replace the sample rows, then run:

```sh
npm run inventory:import -- path/to/inventory.csv
```

The importer checks every row before replacing `data/inventory.yaml`. Multi-value cells use
semicolons. Expansions use `kind=expansion` and identify an imported base game through
`parent_slug` (preferred) or `parent_bgg_id`. A row without `bgg_id` must provide `source_url`
and every `override_*` player/time/age field so it remains fully filterable.

## GitHub setup

1. Create the public `Bahbus/BoardGameInventory` repository and push `main`.
2. Register a noncommercial application at BoardGameGeek and add its token as the Actions
   secret `BGG_API_TOKEN`.
3. Allow Actions to create pull requests in repository Actions settings. The included workflow
   never approves or merges them.
4. Run `bash scripts/configureRepository.sh` while authenticated with GitHub CLI.
5. Enable Dependabot alerts, secret scanning, push protection, and CodeQL if GitHub does not
   enable them automatically.
6. In Pages settings, confirm GitHub Actions is the publishing source.

The setup script creates inventory labels, selects the Actions Pages source, enables the
available public-repository security features, sets conservative workflow defaults, and
protects `main`. Review its requests before running it.

## Public-data rule

Every inventory value is public. Shelf locations must be labels such as `Basement A3`, never
addresses, access instructions, contact details, or other private information.

## Browser support

Current evergreen browsers are supported. The application is responsive and online-only; it
does not install as a PWA or provide an offline cache.

## Attribution

BoardGameGeek data is used under the [BGG XML API terms](https://boardgamegeek.com/wiki/page/XML_API_Terms_of_Use).
Public builds credit BoardGameGeek and link every enriched game back to its source.

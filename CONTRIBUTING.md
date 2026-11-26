# Contributing to Sapphire

Thanks for your interest in Sapphire! Bug reports, translations, documentation and code are all welcome, and you don't need to write code to help.

By participating, you agree to follow our [Code of Conduct](./CODE_OF_CONDUCT.md). To report a security vulnerability, **do not open a public issue**; see [SECURITY.md](./SECURITY.md).

## Table of contents

- [Ways to contribute](#ways-to-contribute)
- [Reporting bugs](#reporting-bugs)
- [Suggesting features](#suggesting-features)
- [Development setup](#development-setup)
- [Project structure](#project-structure)
- [Making changes](#making-changes)
- [Adding a translation](#adding-a-translation)
- [Pull request checklist](#pull-request-checklist)
- [Licensing and sign-off](#licensing-and-sign-off)
- [Maintainer notes: releases](#maintainer-notes-releases)

## Ways to contribute

- **Report a bug** or a rough edge in the UI
- **Suggest a feature** or improvement
- **Translate** the interface into a new language, or improve an existing one
- **Improve the docs**, including this file
- **Fix a bug or build a feature**; issues labelled `good first issue` are a good place to start

For anything larger than a small fix, please **open an issue first** so we can agree on the approach before you spend time on it.

## Reporting bugs

Search the [existing issues](https://github.com/KoRIOz675/Sapphire/issues) first, then open a new one with:

- What you did, what you expected, and what happened instead
- Your OS and version, and the Sapphire version (Settings or the release tag)
- Screenshots or logs if relevant

**Please do not attach your database or exports**: they may contain personal data about you and your contacts. Reproduce the problem with dummy data instead.

## Suggesting features

Open an issue describing the problem you're trying to solve, not only the solution you have in mind. Sapphire is deliberately **local-first and private**, so features that require an account, telemetry, or sending data to a server are unlikely to be accepted into the core app.

## Development setup

### Requirements

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/) 20.19+ or 22.12+ (includes npm)
- [Rust](https://rustup.rs/) (stable toolchain)
- The [Tauri system dependencies](https://v2.tauri.app/start/prerequisites/) for your OS

### Run it

```bash
git clone https://github.com/KoRIOz675/Sapphire
cd Sapphire
npm install
npm run tauri dev
```

The first launch can take several minutes while Rust compiles all dependencies. Later launches are much faster.

### Build an installer

```bash
npm run tauri build
```

Installers are generated in `src-tauri/target/release/bundle/` (`.msi`/`.exe` on Windows, `.deb`/`.AppImage` on Linux). Sapphire is built and tested on Windows and Linux; macOS may work from source but isn't supported yet.

### Where your dev data lives

By default the SQLite database is stored in the user config directory:

| OS      | Path                                                  |
| ------- | ----------------------------------------------------- |
| Windows | `%APPDATA%\fr.nbiproject.sapphire\sapphire.db`        |
| Linux   | `~/.config/fr.nbiproject.sapphire/sapphire.db`        |

The database location can be changed in Settings. Automatic backups always go to a `backups/` folder next to the database file. When testing destructive changes or migrations, **back up or point the app at a throwaway database first**.

## Project structure

```
Sapphire/
├── src/                  # Frontend: React + TypeScript
│   ├── api/              # Typed client for the Tauri commands
│   ├── components/       # Reusable components
│   ├── pages/            # App pages
│   ├── locales/          # UI text (en.json)
│   ├── i18n.ts           # i18next configuration
│   ├── types.ts          # TS types shared with the backend
│   ├── App.tsx           # Router
│   └── main.tsx          # Vite entry point
│
└── src-tauri/            # Backend: Rust
    ├── src/
    │   ├── main.rs       # Binary entry point
    │   ├── lib.rs        # App setup + command registration
    │   ├── db.rs         # Opens the database and runs migrations
    │   ├── migrations/   # Numbered schema migrations
    │   ├── models.rs     # Structs mirroring the tables
    │   ├── commands/     # Handlers exposed to React via invoke()
    │   ├── backup.rs     # Automatic backups
    │   ├── reminder.rs   # Background thread for native reminders
    │   └── schema.sql    # Baseline database schema
    ├── Cargo.toml
    └── tauri.conf.json
```

## Making changes

### Workflow

1. Fork the repo and create a branch from `main` (e.g. `fix/calendar-timezone` or `feat/csv-import-tags`).
2. Make your change in small, focused commits.
3. Run the checks below locally.
4. Open a pull request against `main` and go through the [checklist](#pull-request-checklist).

### Checks your code must pass

CI runs these on every pull request, so run them locally first:

```bash
# Frontend
npx tsc --noEmit
npm run build

# Backend (from src-tauri/)
cargo fmt --check
cargo clippy --all-targets -- -D warnings
cargo test
```

### Typical change: adding or changing a backend feature

A feature that touches data usually involves the whole stack:

1. **Schema:** add a numbered migration in `src-tauri/src/migrations/mod.rs` (don't edit `schema.sql`). Never edit a migration that has already shipped.
2. **Model:** update the struct in `models.rs`.
3. **Command:** add or update the handler in `src-tauri/src/commands/` and register it in `lib.rs`.
4. **Types:** mirror the change in `src/types.ts`.
5. **API client:** expose the command in `src/api/`.
6. **UI:** use it from a page or component, with translated strings (see below).
7. **Tests:** add a Rust test for the backend logic where practical.

### Conventions

- **Commit messages:** [Conventional Commits](https://www.conventionalcommits.org/) style (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`).
- **Rust:** formatted with `cargo fmt`, no Clippy warnings.
- **TypeScript:** strict typing, no `any` unless justified in a comment.
- **No hard-coded UI strings:** every user-facing string goes through i18next.
- **Local-first:** no accounts, analytics or telemetry. The only network request in the app is the update check in `src/api/updates.ts`, which is off by default and only reads the latest public release from GitHub. Don't add others.

### Design decisions worth knowing

- **Action initiator:** `Action` has no `fromPersonId`. The initiator is by definition the CRM user, whose profile (`firstName`, `lastName`, `email`) is stored in the `settings` table under the key `current_user` and edited in **Settings → User profile**.
- **Project status** is a closed list: `Active` / `Inactive`.
- **Launch backup:** a best-effort database backup runs at startup, in addition to the manual button in Settings. The number of backups kept is configurable (default 10).

## UI text

Sapphire's interface is English only. Text goes through [i18next](https://www.i18next.com/) all the same, so every string lives in `src/locales/en.json`: add new text there and use `t("...")` rather than writing it in a component.

If you'd rather not touch the code, open an issue titled "Translation: <language>" and attach the translated file; we'll wire it up.

## Pull request checklist

- [ ] The PR is focused on one change, and linked to an issue if there is one
- [ ] The CI checks above pass locally
- [ ] New or changed UI text is in `src/locales/en.json`, not hard-coded
- [ ] Database changes include a migration, and existing databases keep working
- [ ] Screenshots are included for UI changes
- [ ] Docs and the README are updated if behaviour changed
- [ ] Commits are signed off (see below)

## Licensing and sign-off

Sapphire is licensed under the [Apache License 2.0](./LICENSE). By contributing, you agree that your contribution is licensed under the same terms (section 5 of the license).

We use the [Developer Certificate of Origin](https://developercertificate.org/) (DCO). Certify that you wrote the code, or have the right to submit it, by signing off each commit:

```bash
git commit -s -m "fix: correct reminder time in calendar view"
```

This adds a `Signed-off-by: Your Name <you@example.com>` line to the commit message. Pull requests with unsigned commits can't be merged; `git rebase --signoff main` fixes existing commits.

The name and logo "Sapphire" and "NBI Project" are not covered by the license (see [NOTICE](./NOTICE)); please don't use them to name a fork or imply endorsement.

## Maintainer notes: releases

Two GitHub Actions workflows live in `.github/workflows/`:

- **`ci.yml`** runs on every pull request and on pushes to `main`: type-check and Vite build, `cargo fmt --check`, `cargo clippy -D warnings`, `cargo test`.
- **`release.yml`** runs on tags matching `v*` (or manually via `workflow_dispatch`). It builds with `tauri-apps/tauri-action` for Windows x64 (`.msi`, NSIS `.exe`) and Linux x64 (`.deb`, `.AppImage`), and attaches the artefacts to a **draft** GitHub Release titled "Sapphire version X.Y.Z". No secrets are needed beyond the built-in `GITHUB_TOKEN`.

Release assets always have the same names, with no version or architecture: `Sapphire.exe`, `Sapphire.msi`, `Sapphire.deb`, `Sapphire.AppImage`, plus `SHA256SUMS-Windows.txt` and `SHA256SUMS-Linux.txt`. That keeps links like `https://github.com/KoRIOz675/Sapphire/releases/latest/download/Sapphire.exe` pointing at the latest published release, so the README and [nbi-project.fr](https://nbi-project.fr/) never need updating for a new version. Don't rename them: it would break those links. Only one architecture is built per platform, and pre-releases aren't used (a pre-release is never "latest").

The draft's description is pre-filled from [`.github/RELEASE_TEMPLATE.md`](.github/RELEASE_TEMPLATE.md) (version and changelog link filled in automatically). Edit that file to change the template.

To publish a new version:

```bash
# 1. Bump the version in package.json, src-tauri/Cargo.toml and src-tauri/tauri.conf.json
#    (then run `npm install` and `cargo check` so both lockfiles follow)
# 2. Commit
git commit -am "release: v0.2.0"
# 3. Tag and push
git tag v0.2.0
git push origin main --tags
```

When the workflow finishes **for both platforms**, fill in the release notes from the template (delete empty sections) and switch the release from **Draft** to **Published**, keeping "Set as the latest release" ticked. Publishing before both builds have uploaded their files would briefly break the `latest/download` links. Only the latest version is maintained: a fix is always shipped as a new patch version, which becomes the latest release.

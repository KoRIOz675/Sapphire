# Security Policy

Sapphire stores personal information about you and your contacts, so we take security reports seriously. Thank you for helping keep users safe.

## Supported versions

Only the **latest release** receives security fixes. Please update to the [latest version](https://github.com/KoRIOz675/Sapphire/releases/latest) before reporting, to check that the issue still exists.

| Version        | Supported |
| -------------- | --------- |
| Latest release | ✅        |
| Older releases | ❌        |

## Reporting a vulnerability

**Please do not open a public issue, pull request or discussion for security problems.**

Use one of these private channels:

1. **GitHub private vulnerability reporting** (preferred): go to the [Security tab](https://github.com/KoRIOz675/Sapphire/security) and click **Report a vulnerability**.
2. **Email:** **contribute@nbi-project.fr** with the subject `Sapphire security report`.

Please include, as far as you can:

- A description of the issue and its potential impact
- Steps to reproduce, or a proof of concept
- The affected version and your operating system
- Any suggested fix or mitigation

Please use dummy data in your reproduction; don't send real personal data.

## What to expect

Sapphire is maintained by a small team, so these are targets rather than guarantees:

- **Acknowledgement** within 7 days
- **Initial assessment** (confirmed or not, severity) within 14 days
- **Fix and coordinated disclosure:** we aim to release a fix within 90 days for confirmed issues, sooner for critical ones, and will keep you updated along the way
- **Credit:** with your permission, we'll credit you in the release notes and the published advisory

We ask that you give us a reasonable chance to fix the issue before disclosing it publicly.

## Scope

Examples of issues we want to hear about:

- Remote or local code execution through the app (e.g. via imported JSON/CSV files, rich-text notes, or attachments)
- Path traversal or unsafe file access via attachments, backups, or the configurable database and backup paths
- Overly permissive Tauri capabilities, IPC commands or webview settings
- Cross-site scripting (XSS) in the UI that could reach native commands
- Problems in the build or release pipeline, or the update mechanism, that could allow a tampered installer
- Vulnerable dependencies with a demonstrable impact on Sapphire

Generally **out of scope**:

- Attacks that require an attacker to already have access to your unlocked computer or user account
- Warnings from Windows SmartScreen on unsigned builds (code signing is on the [roadmap](./README.md#roadmap))
- Vulnerabilities in third-party software with no demonstrable impact on Sapphire
- Social engineering, spam, or denial-of-service against GitHub or other third-party services
- Missing best-practice hardening without a concrete exploit

## Safe harbor

If you act in good faith, follow this policy, avoid accessing or destroying data that isn't yours, and don't disrupt other people's use of the software, we will not pursue legal action against you for your research.

## For users

- Download Sapphire only from the [official releases page](https://github.com/KoRIOz675/Sapphire/releases) or [nbi-project.fr](https://nbi-project.fr/)
- Keep the app up to date
- Your data is stored locally in a SQLite database and in your backup folder; protect them as you would any sensitive file (full-disk encryption, a strong OS login, secured backup location)

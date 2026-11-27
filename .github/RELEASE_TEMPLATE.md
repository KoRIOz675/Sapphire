<!--
  Release notes template, used by .github/workflows/release.yml to pre-fill each
  draft release. The workflow fills in two placeholders, written as the
  words VERSION and CHANGELOG_URL wrapped in double curly braces:
    VERSION        the version being released, e.g. 1.0.1
    CHANGELOG_URL  comparison link from the previous release tag
  HTML comments like this one are invisible once the release is published.
-->

<!-- Summarize this release in 1–3 sentences. Delete any empty section before publishing. -->

## What's new
- 

## Improvements
- 

## Bug fixes
- 

## Download

| Platform | File |
| --- | --- |
| Windows | [Sapphire.exe](https://github.com/KoRIOz675/Sapphire/releases/download/v{{VERSION}}/Sapphire.exe) (installer, recommended) · [Sapphire.msi](https://github.com/KoRIOz675/Sapphire/releases/download/v{{VERSION}}/Sapphire.msi) |
| Linux | [Sapphire.AppImage](https://github.com/KoRIOz675/Sapphire/releases/download/v{{VERSION}}/Sapphire.AppImage) (any distribution) · [Sapphire.deb](https://github.com/KoRIOz675/Sapphire/releases/download/v{{VERSION}}/Sapphire.deb) (Debian / Ubuntu) · [Sapphire.rpm](https://github.com/KoRIOz675/Sapphire/releases/download/v{{VERSION}}/Sapphire.rpm) (Fedora) |

Linux packages need glibc 2.39 or later (Ubuntu 24.04, Debian 13, Fedora 44 or newer). macOS isn't supported yet.

**Note:** installers aren't code-signed yet, so Windows SmartScreen may warn on first launch: click **More info**, then **Run anyway**.

<details>
<summary>Verify your download</summary>

Compare your file with `SHA256SUMS-Windows.txt` or `SHA256SUMS-Linux.txt` below, or run:

```
gh attestation verify Sapphire.exe --repo KoRIOz675/Sapphire
```
</details>

**Full changelog:** {{CHANGELOG_URL}}

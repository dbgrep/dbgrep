# Build a desktop app for your PC

DBGrep is an Electron app. You can either run it from source during development, or build a standalone app you can open from your desktop, dock, or Start menu without a terminal.

## What you get

After building, electron-builder writes installable artifacts to the `release/` folder:

| Platform | Typical output |
|----------|----------------|
| macOS (Apple Silicon) | `release/mac-arm64/DBGrep.app` |
| macOS (Intel) | `release/mac/DBGrep.app` |
| Windows | `release/DBGrep Setup *.exe` (installer) and `release/win-unpacked/DBGrep.exe` (portable) |
| Linux | `release/DBGrep-*.AppImage` or `release/linux-unpacked/dbgrep` |

The exact filenames depend on your OS and CPU architecture. Build on the platform you want to run on (build macOS apps on a Mac, Windows apps on Windows, and so on).

## Prerequisites

1. **Node.js 18 or later** — [https://nodejs.org](https://nodejs.org)
2. **npm** — included with Node.js
3. **Native build tools** — required for `better-sqlite3` (SQLite driver):
   - **macOS:** Xcode Command Line Tools
     ```bash
     xcode-select --install
     ```
   - **Windows:** [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with the "Desktop development with C++" workload
   - **Linux:** `build-essential` (Debian/Ubuntu) or equivalent on your distro
     ```bash
     sudo apt install build-essential
     ```

## Step 1 — Get the source

If you already have the project folder, skip to Step 2.

```bash
git clone <repository-url> dbviewer
cd dbviewer
```

## Step 2 — Install dependencies

From the project root:

```bash
npm install
```

This downloads packages and compiles native modules. The first install can take a few minutes.

## Step 3 — Build the desktop app

```bash
npm run build
```

This command:

1. Compiles TypeScript (`tsc`)
2. Bundles the React UI (`vite build`)
3. Packages everything into a desktop app (`electron-builder`)

When it finishes, check the `release/` folder for your app.

## Signed release (macOS / Windows)

If you have code-signing certificates on your machine, you can produce a build that macOS Gatekeeper and Windows SmartScreen will trust without workarounds.

### 1. Configure credentials

```bash
cp .env.signing.example .env.signing
```

Edit `.env.signing` (this file is gitignored).

**macOS — certificate already in Keychain** (most common if you installed it on this Mac):

```bash
security find-identity -v -p codesigning
```

Copy the identity name into `CSC_NAME`, but **omit** the `Developer ID Application:` prefix (electron-builder adds it automatically). For example, if Keychain shows `Developer ID Application: Your Name (TEAMID)`, use:

```
CSC_NAME="Your Name (TEAMID)"
```

You also need Apple notarization credentials:

- `APPLE_ID` — your Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` — create at [appleid.apple.com](https://appleid.apple.com) → App-Specific Passwords
- `APPLE_TEAM_ID` — from [developer.apple.com/account](https://developer.apple.com/account) → Membership details

**macOS or Windows — certificate as a file (.p12 / .pfx):**

```
CSC_LINK=/absolute/path/to/your-certificate.p12
CSC_KEY_PASSWORD=your-certificate-password
```

Comment out `CSC_NAME` if you use `CSC_LINK` instead.

### 2. Build

```bash
chmod +x scripts/build-signed.sh   # first time only
npm run build:signed
```

This compiles the app, signs it with your certificate, and notarizes the macOS build with Apple. Output is still in `release/` — look for `DBGrep-*.dmg` on macOS or `DBGrep Setup *.exe` on Windows.

### 3. Verify (macOS)

```bash
spctl -a -vv release/mac-arm64/DBGrep.app
codesign -dv --verbose=4 release/mac-arm64/DBGrep.app
```

You should see `source=Notarized Developer ID` from `spctl`.

Unsigned local builds still work with `npm run build` (no certificates required).

## Step 4 — Install and run

### macOS

1. Open `release/mac-arm64/DBGrep.app` (or `release/mac/DBGrep.app` on Intel Macs).
2. Drag **DBGrep** to **Applications** to keep it permanently.
3. On first launch, macOS may block the app because it is not signed. Open **System Settings → Privacy & Security** and click **Open Anyway**, or right-click the app and choose **Open**. Signed builds from `npm run build:signed` skip this step.

### Windows

1. Run `release/DBGrep Setup *.exe` to install, **or**
2. Run `release/win-unpacked/DBGrep.exe` directly without installing.

If SmartScreen warns about an unsigned app, choose **More info → Run anyway**.

### Linux

1. Make the AppImage executable and run it:
   ```bash
   chmod +x release/DBGrep-*.AppImage
   ./release/DBGrep-*.AppImage
   ```
2. Or run the unpacked binary: `release/linux-unpacked/dbgrep`

## Run without building (development mode)

Use this while working on the project. It starts the app from source with hot reload:

```bash
npm install
npm start
```

A `sample.db` SQLite file is included for testing connections.

## Troubleshooting

### `npm install` fails on `better-sqlite3`

Install the native build tools for your platform (see Prerequisites), then:

```bash
rm -rf node_modules
npm install
```

### Build succeeds but the app won't open

Delete previous build output and rebuild:

```bash
rm -rf release dist dist-electron
npm run build
```

### Wrong architecture (e.g. app won't run on another Mac)

electron-builder targets the machine you build on. To produce an Intel Mac build from Apple Silicon, add a target in `package.json` under `build.mac` and run:

```bash
npx electron-builder --mac --x64
```

For Windows or Linux installers from macOS, use a Windows or Linux machine (or CI) — cross-compiling is not supported out of the box.

## Quick reference

| Goal | Command |
|------|---------|
| Install dependencies | `npm install` |
| Run in dev mode | `npm start` |
| Build desktop app | `npm run build` |
| Build signed release | `npm run build:signed` |
| Output location | `release/` |

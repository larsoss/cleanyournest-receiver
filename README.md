# CleanYourNest — Custom Google Cast Web Receiver

A small proof-of-concept for the **Nest Hub (1st generation)**. Includes a self-hostable HTTPS Web Receiver, a browser-based sender to launch a registered Cast application, and a one-time Windows PowerShell GitHub-publishing script. No Fuchsia root, SSH, flashing, or Home Assistant access is claimed.

## 1. Publish from Windows

1. Install [Git for Windows](https://git-scm.com/downloads/win) and [GitHub CLI](https://cli.github.com/) if necessary.
2. Unzip the project to `C:\cleanyournest-receiver`. Open PowerShell:

   ```powershell
   cd C:\cleanyournest-receiver
   powershell -ExecutionPolicy Bypass -File .\publish-to-github.ps1
   ```

   GitHub CLI opens a browser for sign-in if necessary. The script uses **the currently authenticated GitHub account**, creates the public repo `cleanyournest-receiver` and pushes the project. If the repo already exists, it stops without overwriting it. The script also tries to enable GitHub Pages; if this fails, go to **Settings → Pages → Deploy from a branch → main → /(root) → Save**.

## 2. Register in Google Cast Developer Console

Choose **Custom Receiver**. Set:

- **Name:** `CleanYourNest`
- **Receiver Application URL:** `https://YOUR-GITHUB-USERNAME.github.io/cleanyournest-receiver/receiver.html`
- **Google Cast for Audio:** unchecked (Nest Hub has display)
- **Android TV package name:** leave empty
- **Guest mode:** optional; not needed for testing

Save and **copy the resulting 8-character Cast Application ID**. Keep the receiver unpublished while testing. Your Nest Hub must already be registered under **Devices → Ready For Testing**. Your receiver's HTTPS URL must load in a browser before saving it in the Console.

## 3. Launch the app

Open `https://YOUR-GITHUB-USERNAME.github.io/cleanyournest-receiver/` in **Google Chrome on Windows**. Paste the **Cast Application ID**, then press **Start op Nest Hub** and select your Nest Hub. The ID is stored only in the browser's localStorage.

Chrome and the Nest Hub should be on a network that supports Cast discovery and permits traffic between the devices. Different VLANs might require mDNS discovery and firewall allowances. A public Pages website cannot access the Nest Hub via a private IP directly; it invokes the Cast Sender SDK instead.

## 4. Test remote debugging

While CleanYourNest is **actually running on the Nest Hub**, open `chrome://inspect/#devices` or test `http://192.168.2.40:9222/json/list` as a read-only request. The debug port may still be blocked by network controls or device firmware. Enabling WebView debugging is not equivalent to unlocking Fuchsia.

## Project files

- `index.html` — sender, with a Cast launch button.
- `receiver.html` — dedicated Google Cast Web Receiver.
- `assets/receiver.js` — Cast Receiver Application Framework initialization.
- `assets/sender.js` — Cast Web Sender SDK initialization and requestSession.
- `assets/style.css` — responsive Nest Hub UI.
- `publish-to-github.ps1` — creates the repository and enables GitHub Pages from your Windows PC.

**Security:** This test repository contains no passwords, HA tokens or local LAN IP references in public JS (other than documentation). Do not add secrets to a public GitHub Pages app. No bootloader access is provided.

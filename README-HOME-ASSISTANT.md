# CleanYourNest · Home Assistant v0.2

Voor jouw bestaande repo `larsoss/cleanyournest-receiver` en Cast Application ID `D0A623B3`.
Deze uitbreiding laat het bestaande Cast-dashboard, de klok en de Custom Receiver werken. Nieuwe interface: actuele Home Assistant status, KNMI weer, binnen-/buitentemperatuur, personen thuis, deurcontacten, lampen en Sonos bediening. Geen root, Fuchsia-ingrepen of aanpassing aan Nest Hub firmware.

## Deel A — Website/GitHub Pages bijwerken op Windows

1. Pak de ZIP uit, bij voorkeur naar `C:\CleanYourNest-HA-v0.2`.
2. Open PowerShell in de uitgepakte map en voer uit:

   ```powershell
   powershell -ExecutionPolicy Bypass -File .\install-in-repo.ps1 -RepoPath 'C:\cleanyournest-receiver'
   ```

   Als de repo nog niet bestaat, clonet het script je publieke repo. Heb je hem elders staan? Pas `-RepoPath` aan. Het script is herhaalbaar.
3. Controleer `git -C 'C:\cleanyournest-receiver' diff` en voer uit:

   ```powershell
   git -C 'C:\cleanyournest-receiver' add .
   git -C 'C:\cleanyournest-receiver' commit -m 'Home Assistant v0.2 dashboard'
   git -C 'C:\cleanyournest-receiver' push origin main
   ```

4. Controleer na GitHub Pages-update je bestaande `receiver.html` en `index.html`. Cast Application ID blijft `D0A623B3`; bestaande registratie kan blijven. Cacheversies zijn toegevoegd aan nieuwe JS/CSS zodat updates zichtbaar zijn.

**Let op**: dit script raakt je bestaande `assets/sender.js` niet aan. Het voegt een hook toe aan `assets/receiver.js` direct vóór `context.start()` en aparte Home Assistant-modules aan de webpagina's.

## Deel B — Backend (bridge) op Proxmox

Deze bridge is een afzonderlijk Python-proces, bijvoorbeeld in een Debian LXC. Hij draait NIET op de Nest Hub en bevat de enige Home Assistant long-lived access token. Hij biedt een beperkte, geauthenticeerde API. De Nest Hub krijgt uitsluitend de aparte `CYN_PAIR_KEY`, via de gekoppelde Cast-sessie op je eigen Windows-computer.

1. Kopieer de map `bridge/` uit de ZIP naar een bestaande Debian LXC, bijvoorbeeld `/opt/cleanyournest/bridge`. Installeer Python 3 als het niet aanwezig is.
2. Maak een token in Home Assistant: je profiel → Beveiliging → langlevende toegangstokens (Long-Lived Access Tokens) → nieuw token. Gebruik liefst een aparte gebruiker voor deze bridge, met zo beperkt mogelijke rechten.
3. In de LXC:

   ```bash
   cd /opt/cleanyournest/bridge
   cp .env.example .env
   python3 -c 'import secrets; print(secrets.token_urlsafe(36))'
   nano .env
   chmod 600 .env
   chmod +x start.sh
   ./start.sh
   ```

   Vul `HA_URL` correct in voor jouw HA-installatie, plak het HA-token en de gegenereerde `CYN_PAIR_KEY`. Vervang `homeassistant.local` indien nodig door jouw actuele interne Home Assistant-adres; dit voorbeeld kan per netwerk verschillen. `CYN_ALLOWED_ORIGIN=https://larsoss.github.io` is het GitHub Pages origin.
4. Test **in de LXC** in een tweede terminal: `curl -s http://127.0.0.1:8787/health` (geen token nodig). Test geauthenticeerd met:

   ```bash
   curl -H "Authorization: Bearer JOUW_CYN_PAIR_KEY" http://127.0.0.1:8787/api/state
   ```

5. Om de bridge blijvend te starten, maak een Linux gebruiker aan (`useradd --system --no-create-home cleanyournest`), voer `chown -R cleanyournest:cleanyournest /opt/cleanyournest/bridge && chmod 600 /opt/cleanyournest/bridge/.env` uit zodat de service het bridge-pad en `.env` kan lezen, kopieer de `.service.example` naar `/etc/systemd/system/cleanyournest-ha.service` en voer `systemctl daemon-reload && systemctl enable --now cleanyournest-ha` uit. Kijk met `journalctl -u cleanyournest-ha -f` bij problemen. Je kunt hem ook aanvankelijk handmatig starten.

### HTTPS via Cloudflare Tunnel / reverse proxy

**Noodzakelijk voor GitHub Pages/Cast:** expose de bridge onder een **eigen, vertrouwde HTTPS-hostnaam** (bijv. `https://nest-api.jouwdomein.nl`) die naar `http://127.0.0.1:8787` op **diezelfde host** wijst. Bij een tunnel in een andere LXC moet je zorgvuldig een bereikbaar intern bridgeadres instellen, bijvoorbeeld `CYN_BIND=0.0.0.0`, maar scherm poort 8787 dan met de Proxmox-firewall af en laat alleen de tunnelproxy verbinding maken.

Publiceer de bridge niet als onbeveiligde HTTP-dienst op internet. Gebruik bij voorkeur tunnelrestricties/rate limiting en controleer dat alleen bekende gebruikers de CYN_PAIR_KEY hebben. Let op dat een externe authpagina zoals Cloudflare Access in de bridge niet automatisch werkt vanuit de Cast-Receiver; kies een geschikte tunnelconfiguratie. De bridge vereist daarnaast zijn eigen sterke koppelcode.

### Entities aanpassen

`bridge/entities.json` bevat de HA entity-ID's die we eerder hebben gebruikt. Pas eventuele afwijkingen in **Developer Tools → States** aan en herstart het bridgeproces. Alleen `light.*` en `media_player.*` zijn hier bedienbaar. Deurcontacten en personen zijn alleen-lezen; geen alarm/slot/automatisering is toegestaan.

## Deel C — Koppelen op de Nest Hub

1. Open de bestaande sender: `https://larsoss.github.io/cleanyournest-receiver/` in Chrome op je Windows-pc.
2. Start je Cast-sessie met App ID `D0A623B3`.
3. Vul je publieke HTTPS bridge URL en geheime `CYN_PAIR_KEY` in het nieuwe blok **Home Assistant koppelen**.
4. Druk op **Koppel Home Assistant**. Zodra de bridge bereikbaar is, toont de Nest Hub actuele gegevens en bedieningsknoppen. De gegevens worden iedere 10 seconden ververst.
5. De koppelcode wordt niet in Github, localStorage of de browserconfig opgeslagen. Na receiver-/browserrestart moet je hem opnieuw vanuit de sender versturen. De bridge draait wel zelfstandig door.

### Test en beperkingen

- `python3 -m unittest -v test_server.py` in `bridge/` controleert de toegestane acties.
- HA-data live testen vereist een bereikbare HA-server en een HTTPS-tunnel; die verbinding is hier nog niet met jouw installatie getest.
- In een gewone browserdemo zonder Cast kun je de lay-out bekijken, maar de koppelcode wordt bewust alleen via de Cast-sender naar de Nest Hub gestuurd.
- Alle persoonsgegevens en media-info blijven privé voor iedereen die niet jouw bridge-key heeft; toch kan iemand met de key de toegestane apparaten bedienen. Houd de key geheim en roteer bij verlies.
- Volume en aan/uit worden direct via de Home Assistant REST API bediend, geen firmwaremodificaties.


#Requires -Version 5.1
<#
 Adds the CleanYourNest Home Assistant v0.2 UI to the existing Cast receiver.
 Does not overwrite the sender's or receiver's original Cast logic.
 Does not commit or push automatically, so you can inspect the diff first.

 Usage:
   powershell -ExecutionPolicy Bypass -File .\install-in-repo.ps1
   powershell -ExecutionPolicy Bypass -File .\install-in-repo.ps1 -RepoPath 'C:\Projects\cleanyournest-receiver'
#>
param([string]$RepoPath = 'C:\cleanyournest-receiver')
$ErrorActionPreference = 'Stop'
$Utf8 = New-Object System.Text.UTF8Encoding($false)
function Fail($Message) { throw "CleanYourNest HA: $Message" }
function ReadUtf8($Path) { return [System.IO.File]::ReadAllText($Path, [System.Text.Encoding]::UTF8) }
function WriteUtf8($Path, $Content) { [System.IO.File]::WriteAllText($Path, $Content, $Utf8) }
function InsertOnce($Text, $Marker, $Addition, $Already) {
    if ($Text.Contains($Already)) { return $Text }
    if (-not $Text.Contains($Marker)) { Fail "Kan invoegpunt niet vinden: $Marker" }
    return $Text.Replace($Marker, $Addition + "`r`n" + $Marker)
}
if (-not (Test-Path -LiteralPath $RepoPath -PathType Container)) {
    Write-Host 'Repository ontbreekt, clonen...' -ForegroundColor Cyan
    git clone 'https://github.com/larsoss/cleanyournest-receiver.git' "$RepoPath"
    if ($LASTEXITCODE -ne 0) { Fail 'git clone mislukt. Controleer Git en de verbinding.' }
}
$receiver = Join-Path $RepoPath 'receiver.html'
$index = Join-Path $RepoPath 'index.html'
$receiverJs = Join-Path $RepoPath 'assets\receiver.js'
foreach ($path in @($receiver, $index, $receiverJs)) {
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { Fail "Bestand ontbreekt: $path" }
}
$sourceDir = $PSScriptRoot
$destAssets = Join-Path $RepoPath 'assets'
$destBridge = Join-Path $RepoPath 'bridge'
New-Item -ItemType Directory -Force -Path $destBridge | Out-Null
foreach ($filename in @('ha.css','ha-receiver.js','ha-sender.js')) {
    Copy-Item -LiteralPath (Join-Path $sourceDir "assets\$filename") -Destination (Join-Path $destAssets $filename) -Force
}
foreach ($filename in @('server.py','entities.json','.env.example','start.sh','cleanyournest-ha.service.example','test_server.py')) {
    Copy-Item -LiteralPath (Join-Path $sourceDir "bridge\$filename") -Destination (Join-Path $destBridge $filename) -Force
}
# Prevent private keys from being accidentally committed to the public Pages repo.
$gitignorePath = Join-Path $RepoPath '.gitignore'
$gitignore = if (Test-Path $gitignorePath) { ReadUtf8 $gitignorePath } else { '' }
if (-not $gitignore.Contains('bridge/.env')) {
    WriteUtf8 $gitignorePath ($gitignore.TrimEnd() + "`r`n# CleanYourNest private credentials`r`nbridge/.env`r`nbridge/__pycache__/`r`n*.pyc`r`n")
}

# Cast receiver view: preserve existing header, clock, Cast state and status tiles.
$html = ReadUtf8 $receiver
$html = InsertOnce $html '<script defer src="assets/receiver.js"></script>' '<script defer src="assets/ha-receiver.js?v=0.2"></script>' 'src="assets/ha-receiver.js'
$html = InsertOnce $html '<script defer src="assets/ha-receiver.js?v=0.2"></script>' '<link rel="stylesheet" href="assets/ha.css?v=0.2">' 'href="assets/ha.css'
if (-not $html.Contains('class="receiver-board ha-ready-design"')) {
    $html = $html.Replace('class="receiver-board"', 'class="receiver-board ha-ready-design"')
}
$html = $html.Replace('Custom Cast Receiver · v0.1', 'Custom Cast Receiver · v0.2')
$html = $html.Replace('<strong>Later koppelen</strong>', '<strong id="ha-tile-status">Niet gekoppeld</strong>')
$panel = @'
<section class="ha-dashboard" aria-label="Home Assistant bedieningspaneel">
  <div class="ha-heading">
    <span class="ha-eyebrow">HOME ASSISTANT · LIVE DASHBOARD</span>
    <span id="ha-connection" class="ha-connection">Niet gekoppeld</span>
  </div>
  <div class="ha-stats">
    <div class="ha-stat"><small>☁ Weer</small><strong><span id="ha-weather-temp">—</span> · <span id="ha-weather-description">—</span></strong><p id="ha-weather-small">Koppeling nog niet ingesteld</p></div>
    <div class="ha-stat"><small>⌂ Binnen / buiten</small><strong><span id="ha-indoor-temp">—</span> / <span id="ha-outdoor-temp">—</span></strong><p>Temperatuur</p></div>
    <div class="ha-stat"><small>♟ Aanwezigheid</small><strong id="ha-people">—</strong><p>Lars en Desiree</p></div>
    <div class="ha-stat"><small>◇ Deuren</small><strong id="ha-doors">—</strong><p>Voor- en achterdeur</p></div>
  </div>
  <div class="ha-content">
    <section class="ha-panel" aria-labelledby="ha-lights-title">
      <div class="ha-panel-header"><h2 id="ha-lights-title">◉ Verlichting</h2><small id="ha-lights-message">Koppeling vereist</small></div>
      <div id="ha-light-list" class="ha-light-list"></div>
    </section>
    <section class="ha-panel" aria-labelledby="ha-media-title">
      <div class="ha-panel-header"><h2 id="ha-media-title">♫ Sonos</h2><small id="ha-last-update">Niet verbonden</small></div>
      <div class="ha-music-row"><select id="ha-media-select" class="ha-select" aria-label="Kies speaker"><option value="">Geen speakers</option></select></div>
      <div id="ha-media-track" class="ha-track">Verbind met Home Assistant om media te bedienen</div>
      <div class="ha-music-buttons"><button type="button" id="ha-media-play" class="ha-control" disabled>▶ Afspelen</button><button type="button" id="ha-media-next" class="ha-control" disabled>⏭ Volgende</button></div>
      <label class="ha-volume-row">Volume <input id="ha-media-volume" type="range" min="0" max="100" value="25" disabled aria-label="Sonos volume"></label>
    </section>
  </div>
  <div id="ha-toast" class="ha-toast" role="alert" hidden></div>
</section>
'@
$html = InsertOnce $html '<section class="tiles">' $panel 'class="ha-dashboard"'
WriteUtf8 $receiver $html

# Register HA custom namespace BEFORE CastReceiverContext.start().
$js = ReadUtf8 $receiverJs
$js = InsertOnce $js 'context.start();' 'window.CleanYourNestHA?.register(context);' 'CleanYourNestHA?.register'
WriteUtf8 $receiverJs $js

# Sender page: add connection input and send through existing Cast session.
$indexHtml = ReadUtf8 $index
$indexHtml = InsertOnce $indexHtml '<div id="output"' '<section class="ha-setup"><h2>⌂ Home Assistant koppelen</h2><p>De Nest Hub gebruikt een HTTPS-bridge op Proxmox. Geen Home Assistant-token in je publieke repository.</p><label for="ha-bridge-url">HTTPS-adres van de bridge</label><input id="ha-bridge-url" type="url" placeholder="https://nest-api.jouwdomein.nl" autocomplete="url"><label for="ha-bridge-key">Geheime koppelcode (wordt niet opgeslagen)</label><input id="ha-bridge-key" type="password" placeholder="Plak hier je CYN_PAIR_KEY" autocomplete="off"><div class="buttons"><button type="button" id="ha-link">Koppel Home Assistant</button></div><div id="ha-sender-status" class="ha-sender-status" role="status">Start eerst je Cast-sessie en koppel daarna Home Assistant.</div></section>' 'id="ha-bridge-url"'
$indexHtml = InsertOnce $indexHtml '</head>' '<link rel="stylesheet" href="assets/ha.css?v=0.2"><script defer src="assets/ha-sender.js?v=0.2"></script>' 'src="assets/ha-sender.js'
WriteUtf8 $index $indexHtml
Write-Host ''
Write-Host 'CleanYourNest HA v0.2 toegevoegd.' -ForegroundColor Green
Write-Host "Repository: $RepoPath"
Write-Host 'Git wijzigingen:' -ForegroundColor Cyan
git -C "$RepoPath" status --short
Write-Host ''
Write-Host 'Controleer de wijzigingen en push daarna zelf:' -ForegroundColor Yellow
Write-Host "git -C `"$RepoPath`" add ."
Write-Host "git -C `"$RepoPath`" commit -m `"Voeg Home Assistant dashboard v0.2 toe`""
Write-Host "git -C `"$RepoPath`" push origin main"
Write-Host ''
Write-Host 'Let op: voor live data moet bridge/server.py op Proxmox draaien via HTTPS.'

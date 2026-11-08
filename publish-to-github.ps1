# CleanYourNest receiver: create PUBLIC GitHub repository and activate GitHub Pages.
# No PATs, password files or HA credentials required.
param([string]$RepoName = 'cleanyournest-receiver')
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
Write-Host "`nCleanYourNest -> GitHub repository" -ForegroundColor Cyan
foreach ($binary in @('git','gh')) {
    if (-not (Get-Command $binary -ErrorAction SilentlyContinue)) {
        Write-Host "MISSING: $binary. Installeer eerst Git for Windows en GitHub CLI." -ForegroundColor Red
        Write-Host 'Git: https://git-scm.com/downloads/win'
        Write-Host 'GitHub CLI: https://cli.github.com/'
        exit 1
    }
}
& gh auth status *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'GitHub-aanmelding via browser starten...' -ForegroundColor Yellow
    & gh auth login --web --git-protocol https
    if ($LASTEXITCODE -ne 0) { throw 'GitHub-aanmelding is niet voltooid.' }
}
$Owner = (& gh api user --jq '.login' | Select-Object -First 1).Trim()
if (-not $Owner) { throw 'Kon GitHub-gebruiker niet vaststellen.' }
$FullName = "$Owner/$RepoName"
Write-Host "Account: $Owner"
Write-Host "Repository: $FullName (PUBLIC)"
& gh repo view $FullName --json name *> $null
if ($LASTEXITCODE -eq 0) { throw "Repository bestaat al: $FullName. Bestaand werk wordt niet overschreven." }
if (Test-Path '.git') { throw 'Er bestaat al een lokale .git-map. Publiceer dit project vanuit een schone uitgepakte ZIP.' }
& git init -b main
if ($LASTEXITCODE -ne 0) { throw 'git init mislukt.' }
& git add --all
if ($LASTEXITCODE -ne 0) { throw 'git add mislukt.' }
& git -c "user.name=$Owner" -c "user.email=$Owner@users.noreply.github.com" commit -m 'Initial CleanYourNest Cast receiver and sender'
if ($LASTEXITCODE -ne 0) { throw 'git commit mislukt.' }
& gh repo create $FullName --public --description 'CleanYourNest custom Google Cast Web Receiver for Nest Hub' --source . --remote origin --push
if ($LASTEXITCODE -ne 0) { throw 'Repository publiceren is mislukt.' }
Write-Host "`nRepository aangemaakt: https://github.com/$FullName" -ForegroundColor Green
Write-Host 'GitHub Pages vanaf branch main / (root) activeren...'
& gh api --method POST "repos/$FullName/pages" -F 'source[branch]=main' -F 'source[path]=/' *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host 'GitHub Pages kon niet automatisch worden ingeschakeld.' -ForegroundColor Yellow
    Write-Host "Open https://github.com/$FullName/settings/pages en kies Deploy from a branch > main > /(root) > Save."
} else {
    Write-Host 'GitHub Pages is geactiveerd.' -ForegroundColor Green
}
Write-Host "`nReceiver Application URL (plak in de Google Cast Console):" -ForegroundColor Cyan
Write-Host "https://$Owner.github.io/$RepoName/receiver.html" -ForegroundColor White
Write-Host "`nSender-pagina (startknop nadat je een Cast Application ID hebt):" -ForegroundColor Cyan
Write-Host "https://$Owner.github.io/$RepoName/" -ForegroundColor White
Write-Host 'De eerste publicatie kan even nodig hebben om zichtbaar te worden.'

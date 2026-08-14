<#
.SYNOPSIS
    Install dsh-sound-alert into the current user's DSH profile.
.DESCRIPTION
    1) Copies the plugin package to ~/.dsh/profiles/<profile>/node_modules/dsh-sound-alert/
    2) Appends the mount entry to cordis.patch.yml (skipped if already present)
    Restart DSH after installation for the plugin to take effect.
.PARAMETER Profile
    DSH profile name. Defaults to "web".
#>
param(
    [string]$Profile = "web"
)

$ErrorActionPreference = "Stop"
$src = $PSScriptRoot
$profileDir = Join-Path $env:USERPROFILE ".dsh\profiles\$Profile"

if (-not (Test-Path $profileDir)) {
    Write-Error "DSH profile directory not found: $profileDir"
    exit 1
}

$dest = Join-Path $profileDir "node_modules\dsh-sound-alert"
if (-not (Test-Path (Split-Path $dest))) {
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
}

# Copy package contents (exclude the install scripts themselves and temp dirs).
# Remove any previous copy first: Copy-Item of a directory into an EXISTING
# destination nests it (dest\lib\lib\...) and leaves stale files behind.
Write-Host "Copying plugin to: $dest"
if (Test-Path $dest) {
    Remove-Item -Recurse -Force $dest
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$exclude = @("install.ps1", "install.sh", ".git", "node_modules", "dist", "smoke-test.mjs")
Get-ChildItem -Path $src -Force | Where-Object {
    $_.Name -notin $exclude
} | ForEach-Object {
    $target = Join-Path $dest $_.Name
    Copy-Item -Path $_.FullName -Destination $target -Recurse -Force
}

# Patch cordis.patch.yml
$patchFile = Join-Path $profileDir "cordis.patch.yml"
if (-not (Test-Path $patchFile)) {
    Write-Error "cordis.patch.yml not found at $patchFile - is this a Web profile?"
    exit 1
}
$patchContent = Get-Content $patchFile -Raw
if ($patchContent -match "dsh-sound-alert") {
    Write-Host "cordis.patch.yml already contains sound-alert; skipping append."
} else {
    # The default profile patch file is a bare `[]` (a flow-style empty
    # sequence). A flow `[]` is its own complete YAML document, so appending
    # the insert block after it would create a SECOND document in one stream
    # and fail to parse. Remove that line before appending.
    $patchContent = $patchContent -replace '(?m)^[ \t]*\[\][ \t]*$', ''
    $patchContent = $patchContent.TrimEnd("`r", "`n") + "`n"
    $entry = @"
- insert:
    - id: sound-alert
      name: 'dsh-sound-alert'
"@
    $newContent = $patchContent + $entry + "`n"
    [System.IO.File]::WriteAllText($patchFile, $newContent, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "Appended sound-alert mount entry to cordis.patch.yml."
}

Write-Host ""
Write-Host "OK. Installed. Please fully restart DSH (plugin-set changes need a restart),"
Write-Host "then reopen the web UI - a sound-alert strip appears above the composer."

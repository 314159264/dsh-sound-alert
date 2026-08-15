<#
.SYNOPSIS
    Install dsh-sound-alert into a DSH profile (Windows).
.DESCRIPTION
    1) Copies the plugin package to <DSH_HOME>/profiles/<profile>/node_modules/dsh-sound-alert/
    2) Appends the mount entry to cordis.patch.yml (skipped if already present)
    Restart DSH after installation for the plugin to take effect.

    DSH_HOME defaults to ~/.dsh; set the DSH_HOME environment variable to
    override (matches how the `dsh` CLI locates its home directory).

    NOTE: if PowerShell refuses to run this script because "running scripts is
    disabled on this system" (the Windows default execution policy), either
    double-click install.cmd or invoke it with a one-off bypass:
        powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1
.PARAMETER Profile
    DSH profile name. Defaults to "web".
.EXAMPLE
    .\install.ps1
.EXAMPLE
    powershell -NoProfile -ExecutionPolicy Bypass -File .\install.ps1 web
#>
param(
    [string]$Profile = "web"
)

$ErrorActionPreference = "Stop"

function Fail([string]$Message) {
    Write-Host "错误: $Message" -ForegroundColor Red
    exit 1
}

# DSH home: honour DSH_HOME (same convention as the `dsh` CLI), else ~/.dsh.
if ($env:DSH_HOME) {
    $dshHome = $env:DSH_HOME
} else {
    $dshHome = Join-Path $env:USERPROFILE ".dsh"
}

# Guard against path traversal in the profile name.
if ($Profile -match '[\\/]' -or $Profile -in @('', '.', '..')) {
    Fail "非法 profile 名: '$Profile'"
}

$src = $PSScriptRoot
$profileDir = Join-Path $dshHome "profiles\$Profile"

if (-not (Test-Path $profileDir)) {
    Fail "找不到 DSH profile 目录: $profileDir （请先运行一次 DSH 的 Web 界面，或检查 DSH_HOME 是否设置正确）"
}

# If the profile was already installed through `dsh plugin add dsh-sound-alert`
# (the package is a declared dependency), stop here: running this script as
# well would mount a SECOND row with the same id and DSH would fail to boot
# with "duplicate loader entry id".
$manifest = Join-Path $profileDir "package.json"
if ((Test-Path $manifest) -and ((Get-Content $manifest -Raw) -match '"dsh-sound-alert"')) {
    Write-Host "检测到该 profile 已通过 'dsh plugin add dsh-sound-alert' 安装（package.json 依赖中已有 dsh-sound-alert）。"
    Write-Host "两种安装方式请勿混用：再运行本脚本会重复挂载，导致 DSH 启动报错 duplicate loader entry id。"
    Write-Host "直接完全重启 DSH 即可。"
    exit 0
}

$dest = Join-Path $profileDir "node_modules\dsh-sound-alert"
if (-not (Test-Path (Split-Path $dest))) {
    New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
}

# Copy package contents (exclude the install scripts themselves and temp dirs).
# Remove any previous copy first: Copy-Item of a directory into an EXISTING
# destination nests it (dest\lib\lib\...) and leaves stale files behind.
Write-Host "复制插件到: $dest"
if (Test-Path $dest) {
    Remove-Item -Recurse -Force $dest
}
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$exclude = @("install.cmd", "install.ps1", "install.sh", ".git", "node_modules", "dist")
Get-ChildItem -Path $src -Force | Where-Object {
    $_.Name -notin $exclude
} | ForEach-Object {
    $target = Join-Path $dest $_.Name
    Copy-Item -Path $_.FullName -Destination $target -Recurse -Force
}

# Patch cordis.patch.yml
$patchFile = Join-Path $profileDir "cordis.patch.yml"
if (-not (Test-Path $patchFile)) {
    Fail "找不到 cordis.patch.yml: $patchFile —— 该 profile 可能不是 Web profile"
}
$patchContent = Get-Content $patchFile -Raw
if ($patchContent -match "dsh-sound-alert") {
    Write-Host "cordis.patch.yml 已包含 sound-alert，跳过追加。"
} else {
    # The default profile patch file is a bare `[]` (a flow-style empty
    # sequence). A flow `[]` is its own complete YAML document, so appending
    # the insert block after it would create a SECOND document in one stream
    # and fail to parse. Remove that line before appending.
    $patchContent = $patchContent -replace '(?m)^[ \t]*\[\][ \t]*\r?$', ''
    $patchContent = $patchContent.TrimEnd("`r", "`n") + "`n"
    $entry = @"
- insert:
    - id: sound-alert
      name: 'dsh-sound-alert'
"@
    $newContent = $patchContent + $entry + "`n"
    [System.IO.File]::WriteAllText($patchFile, $newContent, (New-Object System.Text.UTF8Encoding($false)))
    Write-Host "已在 cordis.patch.yml 追加 sound-alert 挂载配置。"
}

Write-Host ""
Write-Host "OK. 安装完成。请【完全退出并重启 DSH】（插件集变更需要重启才生效），"
Write-Host "重新打开 Web 界面后，输入框上方会出现「🔔 提示音已开启」。"

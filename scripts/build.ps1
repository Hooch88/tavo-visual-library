$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Manifest = Get-Content -Raw -Path 'manifest.json' | ConvertFrom-Json
$Version = $Manifest.version
$OutDir = Join-Path $Root 'dist'
$ZipFile = Join-Path $OutDir "tavo-visual-library-$Version.zip"
$TpgFile = Join-Path $OutDir "tavo-visual-library-$Version.tpg"

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
Remove-Item -Force -ErrorAction SilentlyContinue $ZipFile, $TpgFile

Compress-Archive -Path 'manifest.json','entry.js','locales','ui/panel.html','README.md' -DestinationPath $ZipFile -CompressionLevel Optimal
Rename-Item -Path $ZipFile -NewName (Split-Path -Leaf $TpgFile)

Write-Host "Built: $TpgFile"

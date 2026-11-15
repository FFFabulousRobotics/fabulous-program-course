param([Parameter(Mandatory=$true)][string]$AndroidJar)
$ErrorActionPreference = 'Stop'
$projectDir = Split-Path $PSScriptRoot -Parent
$sdkDir = Join-Path $projectDir 'sdk'
New-Item -ItemType Directory -Path $sdkDir -Force | Out-Null
Add-Type -AssemblyName System.IO.Compression.FileSystem
$gradleHome = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { Join-Path $HOME '.gradle' }
$ftcCache = Join-Path $gradleHome 'caches/modules-2/files-2.1/org.firstinspires.ftc'
foreach ($moduleName in @('RobotCore','Hardware','FtcCommon')) {
    $aarFile = Get-ChildItem (Join-Path $ftcCache "$moduleName\11.0.0") -Recurse -Filter '*.aar' | Select-Object -First 1
    if (!$aarFile) { throw "Missing official SDK artifact: $moduleName 11.0.0" }
    $archive = [IO.Compression.ZipFile]::OpenRead($aarFile.FullName)
    try { [IO.Compression.ZipFileExtensions]::ExtractToFile($archive.GetEntry('classes.jar'), (Join-Path $sdkDir "$moduleName-11.0.0.jar"), $true) } finally { $archive.Dispose() }
}
Copy-Item -LiteralPath $AndroidJar -Destination (Join-Path $sdkDir 'android.jar') -Force
$sourceJar = Get-ChildItem (Join-Path $ftcCache 'RobotCore\11.0.0') -Recurse -Filter '*sources.jar' | Select-Object -First 1
Copy-Item -LiteralPath $sourceJar.FullName -Destination $sdkDir -Force
Get-ChildItem $sdkDir -File | Select-Object Name,Length
javac -version

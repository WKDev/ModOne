param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$CommandArgs
)

$perlCandidates = @(
    "C:\Strawberry\perl\bin",
    "C:\Program Files\Git\usr\bin"
)

foreach ($candidate in $perlCandidates) {
    if (Test-Path (Join-Path $candidate "perl.exe")) {
        $pathParts = @($env:PATH -split ';' | Where-Object { $_ -and $_ -ne $candidate })
        $env:PATH = (@($candidate) + $pathParts) -join ';'
        break
    }
}

$perl = Get-Command perl -ErrorAction SilentlyContinue
if (-not $perl) {
    Write-Error "Perl is required for vendored OpenSSL builds. Install Strawberry Perl or Git for Windows Perl first."
    exit 1
}

$env:OPENSSL_SRC_PERL = $perl.Source

if (-not $CommandArgs -or $CommandArgs.Count -eq 0) {
    Write-Error "No command was provided to scripts/with-perl.ps1."
    exit 1
}

$arguments = @()
$commandArgsList = @($CommandArgs)
if ($commandArgsList[0] -eq '--') {
    if ($commandArgsList.Count -eq 1) {
        Write-Error "No command was provided to scripts/with-perl.ps1."
        exit 1
    }
    $commandArgsList = $commandArgsList[1..($commandArgsList.Count - 1)]
}

$command = $commandArgsList[0]
if ($commandArgsList.Count -gt 1) {
    $arguments = $commandArgsList[1..($commandArgsList.Count - 1)]
}

& $command @arguments
exit $LASTEXITCODE

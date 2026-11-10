<#
.SYNOPSIS
    Regenerates the text evidence in evidence/outputs from a real database run.

.DESCRIPTION
    Runs, and saves the console output of:
      database/11_inspect_schema.sql  -> evidence/outputs/schema_inspection.txt
      database/09_demo_queries.sql    -> evidence/outputs/demo_queries_output.txt
      database/10_validation.sql      -> evidence/outputs/validation_output.txt
    Then the API tests -> evidence/logs/api_tests.log

    Uses PGPASSWORD or %APPDATA%\postgresql\pgpass.conf; otherwise prompts once.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\generate-evidence.ps1
#>
param(
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$AdminUser = "postgres",
    [switch]$SkipApiTests
)

$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $psql = (Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" | Sort-Object FullName -Descending | Select-Object -First 1).FullName
}
if (-not $psql) { Write-Host "psql.exe not found" -ForegroundColor Red; exit 1 }

$prompted = $false
if (-not $env:PGPASSWORD -and -not (Test-Path (Join-Path $env:APPDATA "postgresql\pgpass.conf"))) {
    # Hidden input, kept only in this process's environment; the unmanaged copy is wiped.
    $s = Read-Host "Password for PostgreSQL user '$AdminUser'" -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
    try { $env:PGPASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
    $prompted = $true
}

$out = Join-Path $Root "evidence\outputs"
$logs = Join-Path $Root "evidence\logs"
New-Item -ItemType Directory -Force $out, $logs | Out-Null

function Save-Run($script, $file) {
    $header = "-- Generated $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') by scripts/generate-evidence.ps1`n" +
              "-- Command: psql -h $DbHost -p $Port -U $AdminUser -d cinemind_db -f database/$script`n"
    $body = & $psql -h $DbHost -p $Port -U $AdminUser -d cinemind_db -X -P pager=off -f (Join-Path $Root "database\$script") 2>&1 |
        ForEach-Object { "$_" }
    ($header + ($body -join "`n")) | Out-File -Encoding utf8 (Join-Path $out $file)
    Write-Host "wrote evidence/outputs/$file (exit $LASTEXITCODE)"
}

try {
    & $psql -h $DbHost -p $Port -U $AdminUser -d cinemind_db -X -t -A -c "SELECT version();" |
        Out-File -Encoding utf8 (Join-Path $out "postgres_version.txt")
    Save-Run "11_inspect_schema.sql" "schema_inspection.txt"
    Save-Run "09_demo_queries.sql" "demo_queries_output.txt"
    Save-Run "10_validation.sql" "validation_output.txt"

    if (-not $SkipApiTests) {
        Push-Location (Join-Path $Root "apps\api")
        npm test 2>&1 | ForEach-Object { "$_" } | Out-File -Encoding utf8 (Join-Path $logs "api_tests.log")
        Write-Host "wrote evidence/logs/api_tests.log (exit $LASTEXITCODE)"
        Pop-Location
    }
}
finally {
    if ($prompted) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
}

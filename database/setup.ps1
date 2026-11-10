<#
.SYNOPSIS
    Creates and populates the CineMind 2.0 PostgreSQL database (cinemind_db).

.DESCRIPTION
    Runs the ordered SQL scripts with psql:
      00 create database      (connected to "postgres")
      01 schema, 02 constraints/indexes, 03 functions, 04 triggers,
      05 procedures, 06 views, 07 seed data, 08 database roles
      10 validation           (self-test; changes are rolled back)
    Optionally 09 demo queries (-Demo).

    Password handling (nothing is stored in plain text by this script):
      * The admin password is taken from PGPASSWORD or %APPDATA%\postgresql\pgpass.conf
        if available; otherwise you are prompted once (hidden input) and it is kept
        only in this process's environment.
      * The runtime role cinemind_app gets the password DB_PASSWORD from apps/api/.env
        (git-ignored). If that file is missing you are prompted.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File database\setup.ps1
    powershell -ExecutionPolicy Bypass -File database\setup.ps1 -Reset -Demo
#>
param(
    [string]$DbHost = "localhost",
    [int]$Port = 5432,
    [string]$AdminUser = "postgres",
    [string]$Database = "cinemind_db",
    [switch]$Reset,          # DROP and recreate the database (deletes all data)
    [switch]$Demo,           # also run 09_demo_queries.sql
    [switch]$SkipValidation  # skip 10_validation.sql
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RepoRoot = Split-Path -Parent $ScriptDir

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Fail($msg) { Write-Host "`nERROR: $msg" -ForegroundColor Red; exit 1 }

# ---------------------------------------------------------------- find psql
Write-Step "Locating psql"
$psql = (Get-Command psql -ErrorAction SilentlyContinue).Source
if (-not $psql) {
    $candidate = Get-ChildItem "C:\Program Files\PostgreSQL\*\bin\psql.exe" -ErrorAction SilentlyContinue |
        Sort-Object { [int]($_.Directory.Parent.Name -replace '\D', '') } -Descending |
        Select-Object -First 1
    if ($candidate) { $psql = $candidate.FullName }
}
if (-not $psql) {
    Fail "psql.exe not found. Install PostgreSQL, or add 'C:\Program Files\PostgreSQL\<version>\bin' to PATH."
}
Write-Host "Using $psql"

# ---------------------------------------------------------------- admin password
# Reads hidden input and returns it as plain text, wiping the temporary
# unmanaged copy. The value is never written to disk.
function Read-Secret([string]$Prompt) {
    $secure = Read-Host $Prompt -AsSecureString
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) }
}

# ---------------------------------------------------------------- runtime role password
# Resolved and checked BEFORE touching the database. Taken from DB_PASSWORD in
# apps/api/.env (git-ignored) so the API and the role always match.
$appPassword = $null
$apiEnv = Join-Path $RepoRoot "apps\api\.env"
if (Test-Path $apiEnv) {
    $line = Select-String -Path $apiEnv -Pattern '^\s*DB_PASSWORD\s*=' | Select-Object -First 1
    if ($line) { $appPassword = ($line.Line -split '=', 2)[1].Trim().Trim('"') }
}
if (-not $appPassword) {
    $appPassword = Read-Secret "Password to set for database role cinemind_app (must match DB_PASSWORD in apps/api/.env)"
}
if ($appPassword -match 'replace-with|change-me' -or $appPassword.Length -lt 12) {
    Fail ("DB_PASSWORD in apps/api/.env is a placeholder or shorter than 12 characters. " +
          "Set a real password there first (see apps/api/.env.example).")
}

$promptedPassword = $false
$pgpass = Join-Path $env:APPDATA "postgresql\pgpass.conf"
if (-not $env:PGPASSWORD -and -not (Test-Path $pgpass)) {
    # Kept only in this PowerShell process's environment for the psql calls below,
    # and removed again in the finally block at the end of the script.
    $env:PGPASSWORD = Read-Secret "Password for PostgreSQL user '$AdminUser'"
    $promptedPassword = $true
}

function Invoke-Psql {
    param([string]$Db, [string]$File, [string[]]$Extra = @())
    $psqlArgs = @("-h", $DbHost, "-p", $Port, "-U", $AdminUser, "-d", $Db,
                  "-v", "ON_ERROR_STOP=1", "-X", "-q") + $Extra
    if ($File) { $psqlArgs += @("-f", $File) }
    # Out-Host keeps psql output out of the function's return value.
    & $psql @psqlArgs | Out-Host
    return $LASTEXITCODE
}

try {
    # ------------------------------------------------------------ connection test
    Write-Step "Testing connection to ${DbHost}:${Port} as $AdminUser"
    & $psql -h $DbHost -p $Port -U $AdminUser -d postgres -X -t -A -c "SELECT version();"
    if ($LASTEXITCODE -ne 0) {
        Fail ("Cannot connect. Check that the PostgreSQL service is running " +
              "(services.msc -> postgresql-x64-NN), the port, and the password.")
    }

    # ------------------------------------------------------------ optional reset
    if ($Reset) {
        Write-Step "Dropping database $Database (-Reset)"
        & $psql -h $DbHost -p $Port -U $AdminUser -d postgres -X -v ON_ERROR_STOP=1 `
            -c "DROP DATABASE IF EXISTS $Database WITH (FORCE);"
        if ($LASTEXITCODE -ne 0) { Fail "Could not drop $Database." }
    }

    # ------------------------------------------------------------ ordered scripts
    Write-Step "00_create_database.sql"
    if ((Invoke-Psql -Db "postgres" -File (Join-Path $ScriptDir "00_create_database.sql")) -ne 0) {
        Fail "00_create_database.sql failed."
    }

    $scripts = @(
        "01_schema.sql", "02_constraints_indexes.sql", "03_functions.sql", "04_triggers.sql",
        "05_procedures.sql", "06_views.sql", "07_seed_data.sql", "08_roles_permissions.sql"
    )
    foreach ($s in $scripts) {
        Write-Step $s
        if ((Invoke-Psql -Db $Database -File (Join-Path $ScriptDir $s)) -ne 0) {
            Fail "$s failed. Fix the error shown above and re-run (scripts are re-runnable)."
        }
    }

    # ------------------------------------------------------------ runtime role password
    Write-Step "Setting password for cinemind_app"
    # Sent through stdin, so the password never appears on a command line.
    $escaped = $appPassword.Replace("'", "''")
    "ALTER ROLE cinemind_app PASSWORD '$escaped';" |
        & $psql -h $DbHost -p $Port -U $AdminUser -d $Database -X -q -v ON_ERROR_STOP=1 -f -
    if ($LASTEXITCODE -ne 0) { Fail "Could not set the cinemind_app password." }
    $appPassword = $null; $escaped = $null
    Write-Host "cinemind_app password set."

    # ------------------------------------------------------------ demo + validation
    if ($Demo) {
        Write-Step "09_demo_queries.sql"
        if ((Invoke-Psql -Db $Database -File (Join-Path $ScriptDir "09_demo_queries.sql")) -ne 0) {
            Fail "09_demo_queries.sql failed."
        }
    }
    if (-not $SkipValidation) {
        Write-Step "10_validation.sql"
        if ((Invoke-Psql -Db $Database -File (Join-Path $ScriptDir "10_validation.sql")) -ne 0) {
            Fail "10_validation.sql reported a failing check (see FAIL message above)."
        }
    }

    Write-Host "`nCineMind database is ready: $Database on ${DbHost}:${Port}" -ForegroundColor Green
}
finally {
    if ($promptedPassword) { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
}

# ============================================================================
# Au PDF — AUTO-TEST & AUTO-DEBUG script
# ----------------------------------------------------------------------------
# 1. Launches the PDF engine (sidecar) exactly like the app does
#    (env SIDECAR_TOKEN + CLI args) and waits for its ready payload.
# 2. Exercises EVERY engine function that backs all 15 tools of Au PDF:
#      boxes, content-bbox, preflight, impose, bleed, boxes/apply,
#      pages/apply, layers, layers/visibility, layers/flatten,
#      output/info, output/sample, output/render, nest, tile, stamp,
#      trim-shift, knockout, variable-data, bon/analyze, bon, bon/resize
# 3. Validates each response (HTTP 2xx + expected JSON shape).
# 4. AUTO-DEBUG: on failure it auto-restarts the engine and retries that
#    function once, captures engine stderr, and writes a full report.
#
# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts\auto-test.ps1
#   powershell -ExecutionPolicy Bypass -File scripts\auto-test.ps1 -Pdf "C:\path\file.pdf"
#   powershell -ExecutionPolicy Bypass -File scripts\auto-test.ps1 -Gui   # also smoke-launch the built app
# ============================================================================
param(
  [string]$Pdf = '',
  [switch]$Gui,
  [string]$Report = ''
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

# ---- resolve test PDF ------------------------------------------------------
if (-not $Pdf -or -not (Test-Path $Pdf)) {
  $candidates = @(
    (Join-Path $root 'test-samples\sample.pdf'),
    'C:\Users\In PD\Desktop\Done\90x54.pdf',
    'C:\Users\In PD\Desktop\Done\142x100.pdf'
  )
  foreach ($c in $candidates) { if (Test-Path $c) { $Pdf = $c; break } }
}
if (-not $Pdf -or -not (Test-Path $Pdf)) {
  Write-Host 'NO TEST PDF FOUND. Pass one with -Pdf "path\to\file.pdf"' -ForegroundColor Red
  exit 2
}

# ---- report path -----------------------------------------------------------
if (-not $Report) { $Report = Join-Path $root 'auto-test-report.log' }
$reportLines = New-Object System.Collections.Generic.List[string]
function Log([string]$msg, [string]$color = 'Gray') {
  Write-Host $msg -ForegroundColor $color
  $reportLines.Add($msg)
}
function Line([string]$s = '') { $reportLines.Add($s) }

Log "Au PDF AUTO-TEST - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" 'Cyan'
Log "Test PDF : $Pdf"
Line ''


# ---- engine launcher -------------------------------------------------------
$sidecarCandidates = @(
  (Join-Path $root 'resources\sidecar\sidecar.exe'),
  (Join-Path $root 'dist\win-unpacked\resources\sidecar\sidecar.exe'),
  (Join-Path $root 'dist\win-unpacked\resources\app.asar.unpacked\resources\sidecar\sidecar.exe')
)
$sidecar = $sidecarCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $sidecar) { Log "FATAL: sidecar.exe not found. Build first (npm run build / package)." 'Red'; exit 2 }
Log "Sidecar : $sidecar"
$baselineSidecarPids = @(
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.ExecutablePath -eq $sidecar } |
    ForEach-Object { [int]$_.ProcessId }
)

function Stop-TestSidecars {
  # PyInstaller may hand execution to a child and let the Process object exit,
  # so killing only the originally spawned PID can leave the actual server alive.
  # Preserve processes that existed before this test and stop only new ones.
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object {
      $_.ExecutablePath -eq $sidecar -and
      $baselineSidecarPids -notcontains [int]$_.ProcessId
    } |
    ForEach-Object {
      Stop-Process -Id ([int]$_.ProcessId) -Force -ErrorAction SilentlyContinue
    }
}

$script:sidecarProc = $null
$script:engineInfo = $null
$script:engineLogs = New-Object System.Collections.Generic.List[string]

function Start-Engine {
  if ($script:sidecarProc -and -not $script:sidecarProc.HasExited) { Stop-Engine }
  Start-Sleep -Milliseconds 300
  $token = -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $sidecar
  $psi.UseShellExecute = $false
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $psi.CreateNoWindow = $true
  # SIDECAR_TOKEN is the ONLY channel the engine accepts the token from
  # (verified 2026-08-25); it ignores --token CLI args.
  $psi.EnvironmentVariables['SIDECAR_TOKEN'] = $token
  $psi.Arguments = "--port 8765 --token $token"
  $script:sidecarProc = New-Object System.Diagnostics.Process
  $script:sidecarProc.StartInfo = $psi
  try { $null = $script:sidecarProc.Start() } catch {
    Log "Engine spawn error: $($_.Exception.Message)" 'Red'; return $false
  }
  $port = $null
  $deadline = (Get-Date).AddSeconds(15)
  while ((Get-Date) -lt $deadline -and $null -eq $port) {
    if ($script:sidecarProc.HasExited) { break }
    try {
      $line = $script:sidecarProc.StandardOutput.ReadLine()
      if ($line) {
        $script:engineLogs.Add($line)
        try {
          $j = $line | ConvertFrom-Json
          if ($j.ready -eq $true -and $j.port) { $port = [int]$j.port }
        } catch { if ($line -match 'Uvicorn running|Application startup complete') { $port = 8765 } }
      }
    } catch { break }
  }
  if ($null -eq $port) { Log "Engine did not become ready." 'Red'; return $false }
  $script:engineInfo = @{ port = $port; token = $token }
  Log "Engine ready on port $port" 'Green'
  try {
    $procRef = $script:sidecarProc
    $null = $procRef.StandardError.ReadToEndAsync().ContinueWith({
      param($t)
      if ($t.Result) { $script:engineLogs.Add("[stderr] $($t.Result)") }
    })
  } catch {}
  return $true
}

function Stop-Engine {
  if ($script:sidecarProc -and -not $script:sidecarProc.HasExited) {
    try {
      $pidv = $script:sidecarProc.Id
      $null = Start-Process 'taskkill' -ArgumentList @('/PID', "$pidv", '/T', '/F') -NoNewWindow -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
    } catch {}
    $script:sidecarProc.Dispose()
  }
  $script:sidecarProc = $null
  $script:engineInfo = $null
}


# ---- HTTP helper -----------------------------------------------------------
$script:base = ''
function Invoke-EngineTest {
  param([string]$Name, [string]$Endpoint, [hashtable]$Body, [switch]$Binary,
        [scriptblock]$Validate, [int]$TimeoutSec = 60)
  $attempts = 0
  while ($attempts -lt 2) {
    $attempts++
    try {
      if (-not $script:engineInfo) { throw 'Engine not connected' }
      $url = "http://127.0.0.1:$($script:engineInfo.port)$Endpoint"
      $headers = @{ Authorization = "Bearer $($script:engineInfo.token)" }
      if ($Binary) {
        $resp = Invoke-WebRequest -Uri $url -Headers $headers -Method Post -ContentType 'application/json' `
                -Body ($Body | ConvertTo-Json -Depth 12) -TimeoutSec $TimeoutSec -UseBasicParsing
        if ($resp.StatusCode -lt 200 -or $resp.StatusCode -ge 300) { throw "HTTP $($resp.StatusCode)" }
        if ($Validate) { & $Validate -Bytes ([byte[]]$resp.Content) } else { if ($resp.RawContentLength -eq 0) { throw 'empty response' } }
      } else {
        $BodyObj = if ($Body) { $Body | ConvertTo-Json -Depth 12 } else { $null }
        $resp = Invoke-RestMethod -Uri $url -Headers $headers -Method Post -ContentType 'application/json' `
                -Body $BodyObj -TimeoutSec $TimeoutSec
        if ($Validate) { & $Validate -Data $resp }
      }
      Log ("PASS  {0}" -f $Name) 'Green'
      Line "  -> $Endpoint"
      return $true
    } catch {
      Line "  FAIL $Name :: $($_.Exception.Message)"
      # AUTO-DEBUG: restart engine once and retry
      if ($attempts -eq 1) {
        Log ("RETRY {0} (engine restart)" -f $Name) 'Yellow'
        if (Start-Engine) { continue }
      }
      Log ("FAIL  {0}" -f $Name) 'Red'
      return $false
    }
  }
  Log ("FAIL  {0}" -f $Name) 'Red'
  return $false
}

# ---- test payloads ---------------------------------------------------------
$tmpDir = Join-Path $env:TEMP ("au-pdf-test-" + [guid]::NewGuid().ToString('N').Substring(0,8))
New-Item -ItemType Directory -Path $tmpDir -Force | Out-Null
$out1 = Join-Path $tmpDir 'out-impose.pdf'
$out2 = Join-Path $tmpDir 'out-bleed.pdf'
$out3 = Join-Path $tmpDir 'out-boxes.pdf'
$out4 = Join-Path $tmpDir 'out-pages.pdf'
$out5 = Join-Path $tmpDir 'out-layervis.pdf'
$out6 = Join-Path $tmpDir 'out-layerflat.pdf'
$out7 = Join-Path $tmpDir 'out-nest.pdf'
$out8 = Join-Path $tmpDir 'out-tile.pdf'
$out9 = Join-Path $tmpDir 'out-stamp.pdf'
$out10 = Join-Path $tmpDir 'out-trim.pdf'
$out11 = Join-Path $tmpDir 'out-knockout.pdf'
$out12 = Join-Path $tmpDir 'out-vdp.pdf'
$out13 = Join-Path $tmpDir 'out-bon.pdf'
$out14 = Join-Path $tmpDir 'out-bon-resize.pdf'
$csvPath = Join-Path $tmpDir 'vdp-data.csv'
Set-Content -Path $csvPath -Value "name`r`nAu PDF" -Encoding UTF8

# Start the engine before running any test
if (-not (Start-Engine)) { Log 'FATAL: could not start engine; aborting.' 'Red'; exit 2 }

$results = @()
$results += Invoke-EngineTest 'boxes' '/boxes' @{ path = $Pdf } -Validate {
  param($Data) if (-not $Data.pages -or $Data.pages.Count -lt 1) { throw 'no pages' }
}
$results += Invoke-EngineTest 'content-bbox' '/content-bbox' @{ path = $Pdf; pages = @(0) } -Validate {
  param($Data) if ($null -eq $Data.items) { throw 'no items' }
}
$results += Invoke-EngineTest 'preflight' '/preflight' @{ path = $Pdf; min_dpi = 300 } -Validate {
  param($Data) if ($null -eq $Data.page_count) { throw 'no page_count' }
}
$results += Invoke-EngineTest 'impose' '/impose' @{ src = $Pdf; out = $out1; mode = 'nup'; cols = 2; rows = 1; sheet_w = 297; sheet_h = 210 } -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'bleed' '/bleed' @{ src = $Pdf; out = $out2; pages = @(0); mode = 'all'; amount = 5 } -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'boxes/apply' '/boxes/apply' @{ src = $Pdf; out = $out3; pages = @(0); box_edits = @(@{ target = 'trim'; auto_content = $true }) } -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'pages/apply' '/pages/apply' @{ src = $Pdf; out = $out4; arrangement = @(@{ source = 0 }, @{ source = 0 }) } -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'layers' '/layers' @{ path = $Pdf } -Validate {
  param($Data) if ($null -eq $Data.layers) { throw 'no layers key' }
}
$results += Invoke-EngineTest 'layers/visibility' '/layers/visibility' @{ src = $Pdf; out = $out5; on = @(); off = @() }
$results += Invoke-EngineTest 'layers/flatten' '/layers/flatten' @{ src = $Pdf; out = $out6 }
$results += Invoke-EngineTest 'output/info' '/output/info' @{ path = $Pdf; page = 0; x = 3; y = 3 } -Validate {
  param($Data) if ($null -eq $Data.has_transparency) { throw 'no info' }
}
$results += Invoke-EngineTest 'output/sample' '/output/sample' @{ path = $Pdf; page = 0; x = 3; y = 3; size = 1 } -Validate {
  param($Data) if ($null -eq $Data.k -and $null -eq $Data.c) { throw 'no sample' }
}
$results += Invoke-EngineTest 'output/render' '/output/render' @{ path = $Pdf; page = 0; zoom = 50 } -Binary
$results += Invoke-EngineTest 'nest' '/nest' @{ out = $out7; sheet_w = 500; sheet_h = 500; margin = 5; gap = 5; parts = @(@{ src_path = $Pdf; qty = 2; rotate = '0'; shape = 'content' }) } -Validate {
  param($Data) if ($null -eq $Data.sheets) { throw 'no sheets' }
}
$results += Invoke-EngineTest 'tile' '/tile' @{ src = $Pdf; out = $out8; pages = @(0); mode = 'cr'; cols = 2; rows = 1 } -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'stamp' '/stamp' @{ src = $Pdf; out = $out9; pages = @(0); numbering = $true; number_start = 1; font = 'Helvetica'; size = 10; color = @(0,0,0) } -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'trim-shift' '/trim-shift' @{ src = $Pdf; out = $out10; pages = @(0); shift_x = 0; shift_y = 0; creep_mode = 'linear' } -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'knockout' '/knockout' @{ src = $Pdf; out = $out11; pages = @(0); tolerance = 12; dpi = 150 } -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'variable-data' '/variable-data' @{
  src = $Pdf; out = $out12; new_doc = $true; csv_path = $csvPath
  fields = @(@{ text = '{{name}}'; page = 0; anchor = 'top-left'; off_x = 0; off_y = 0; font = 'Helvetica'; size = 12; color = @(0,0,0); rotate = 0 })
} -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'bon/analyze' '/bon/analyze' @{ path = $Pdf } -Validate {
  param($Data) if ($null -eq $Data.layers) { throw 'no layers key' }
}
$results += Invoke-EngineTest 'bon' '/bon' @{
  src = $Pdf; out = $out13; target = 'current'; sheet_w = 320; sheet_h = 450; art_margin = 3; pages = @(0); layers = @()
} -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}
$results += Invoke-EngineTest 'bon/resize' '/bon/resize' @{
  src = $out13; out = $out14; sheet_w = 330; sheet_h = 460
} -Validate {
  param($Data) if ($null -eq $Data.out) { throw 'no out' }
}

# ---- auto-debug: verify outputs exist where expected -----------------------
$produced = @($out1, $out2, $out3, $out4, $out8, $out9, $out10, $out11, $out12, $out13, $out14)
$missingOut = @($produced | Where-Object { -not (Test-Path $_) })
if ($missingOut.Count) {
  Line "  WARN outputs not written: $($missingOut -join ', ')"
}

Stop-Engine
Stop-TestSidecars


# ---- summary ---------------------------------------------------------------
$passCount = ($results | Where-Object { $_ }).Count
$total = $results.Count
$ok = ($passCount -eq $total -and $missingOut.Count -eq 0)
Line ''
Line ('=' * 60)
Line ("RESULT: $passCount / $total engine functions PASSED")
if ($passCount -eq $total) { Line 'ALL FUNCTIONS OK' } else { Line 'SOME FUNCTIONS FAILED - see details above; auto-DEBUG performed engine restart+retry.' }
Line ('=' * 60)

if ($missingOut.Count) { $ok = $false }

# ---- optional GUI smoke launch of built app --------------------------------
if ($Gui) {
  Line ''
  Line 'GUI SMOKE TEST'
  $appCandidates = @(
    (Join-Path $root 'dist\win-unpacked\Au PDF.exe'),
    (Join-Path $root 'dist\win-unpacked\PDF Prepress Studio.exe'),
    (Join-Path $root 'dist\win-unpacked\PDF in PD.exe')
  )
  $app = $appCandidates | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $app) {
    Line 'GUI: no built app exe found (run npm run build / package first). SKIP'
  } else {
    Line "GUI: launching $app"
    try {
      $p = Start-Process $app -PassThru
      Start-Sleep -Seconds 8
      if ($p.HasExited) {
        Line "GUI: app exited early (code $($p.ExitCode)) - ERROR"
        $ok = $false
      } else {
        Line "GUI: app running (PID $($p.Id)) - OK, closing..."
        $null = Start-Process 'taskkill' -ArgumentList @('/PID', "$($p.Id)", '/T', '/F') -NoNewWindow -Wait -WindowStyle Hidden -ErrorAction SilentlyContinue
        # Electron's launcher PID can exit after handing off to another process.
        # Clean every process created from this exact unpacked executable.
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
          Where-Object { $_.ExecutablePath -eq $app } |
          ForEach-Object { Stop-Process -Id ([int]$_.ProcessId) -Force -ErrorAction SilentlyContinue }
        Start-Sleep -Milliseconds 500
        Stop-TestSidecars
      }
    } catch {
      Line "GUI: launch error: $($_.Exception.Message)"
      $ok = $false
    }
  }
}

# ---- engine diagnostics section (auto-debug info) --------------------------
if ($script:engineLogs.Count) {
  Line ''
  Line '--- ENGINE DIAGNOSTICS (last 25 lines) ---'
  $script:engineLogs | Select-Object -Last 25 | ForEach-Object { Line "  $_" }
}

$reportLines | Set-Content -Path $Report -Encoding UTF8
Line ''
Line "Report written: $Report"
$statusMsg = if ($ok) { 'OK' } else { 'FAILED' }
$statusColor = if ($ok) { 'Green' } else { 'Red' }
Log ("AUTO-TEST COMPLETE - Overall: " + $statusMsg) $statusColor

try { Remove-Item $tmpDir -Recurse -Force -ErrorAction SilentlyContinue } catch {}
if ($ok) { exit 0 } else { exit 1 }

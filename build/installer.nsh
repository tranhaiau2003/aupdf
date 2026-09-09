; ============================================================================
; Custom NSIS hooks for electron-builder (referenced from electron-builder.json)
; Purpose: make IN-PLACE UPGRADES reliable on Windows.
;
; Before the installer extracts new files it must close every running
; instance of the app (current AND legacy product name) plus the Python
; sidecar engine, otherwise:
;   - app .exe is locked  -> "Error opening file for writing"
;   - sidecar.exe locked  -> extraction failure in resources\sidecar\
;   - stale lockfile      -> "Lock file can not be created! Error code: 32"
;
; NOTE: every nsExec::Exec pushes its exit code onto the NSIS stack.
; We must Pop after each call to keep the stack balanced.
; ============================================================================

!macro customInit
  DetailPrint "Closing running instances of Au PDF..."
  nsExec::Exec 'taskkill /IM "Au PDF.exe" /T /F'
  Pop $0
  ; Legacy product names used by older builds
  nsExec::Exec 'taskkill /IM "PDF Prepress Studio.exe" /T /F'
  Pop $0
  nsExec::Exec 'taskkill /IM "PDF in PD.exe" /T /F'
  Pop $0
  DetailPrint "Closing PDF engine (sidecar)..."
  nsExec::Exec 'taskkill /IM "sidecar.exe" /T /F'
  Pop $0
  ; Give Windows a moment to release file handles before extraction starts
  Sleep 1000
!macroend

!macro customInstall
  ; Remove stale single-instance lock files left behind by a crashed
  ; previous instance (prevents "Lock file can not be created!" and
  ; cache access errors on first launch after upgrade).
  ; All running instances were killed in customInit, so this is safe.
  Delete "$APPDATA\pdf-prepress-studio\lockfile"
  Delete "$APPDATA\pdf-prepress-studio\SingletonLock"
  Delete "$APPDATA\pdf-prepress-studio\SingletonCookie"
  Delete "$APPDATA\pdf-prepress-studio\SingletonSocket"

  ; Register Au PDF directly in the Windows "Open with" menu.  electron-
  ; builder's fileAssociations creates classes on a fresh install, but Windows
  ; can retain old association metadata after an in-place upgrade.  These HKCU
  ; entries are explicit, do not change the user's default viewer, and work
  ; without administrator rights.
  WriteRegStr HKCU "Software\Classes\Applications\Au PDF.exe" "FriendlyAppName" "Au PDF"
  WriteRegStr HKCU "Software\Classes\Applications\Au PDF.exe\shell\open\command" "" '"$INSTDIR\Au PDF.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\AuPDF.Document" "" "Au PDF Document"
  WriteRegStr HKCU "Software\Classes\AuPDF.Document\shell\open\command" "" '"$INSTDIR\Au PDF.exe" "%1"'
  WriteRegStr HKCU "Software\Classes\.pdf\OpenWithProgids" "AuPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\.png\OpenWithProgids" "AuPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\.jpg\OpenWithProgids" "AuPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\.jpeg\OpenWithProgids" "AuPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\.webp\OpenWithProgids" "AuPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\.bmp\OpenWithProgids" "AuPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\.gif\OpenWithProgids" "AuPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\.ico\OpenWithProgids" "AuPDF.Document" ""
  WriteRegStr HKCU "Software\Classes\.svg\OpenWithProgids" "AuPDF.Document" ""
  ; Prompt Explorer to refresh the association cache immediately after upgrade.
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

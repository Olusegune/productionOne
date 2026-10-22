; Gives .pone and .pguy documents their own icon (the application icon stays on the program itself).
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\.pone" "" "Production One Project"
  WriteRegStr SHCTX "Software\Classes\Production One Project\DefaultIcon" "" "$INSTDIR\project-file.ico"
  WriteRegStr SHCTX "Software\Classes\Production Guy Project\DefaultIcon" "" "$INSTDIR\project-file.ico"
  WriteRegStr SHCTX "Software\Classes\pone\DefaultIcon" "" "$INSTDIR\project-file.ico"
  WriteRegStr SHCTX "Software\Classes\pguy\DefaultIcon" "" "$INSTDIR\project-file.ico"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

; Remove the extra document-icon keys the install hook wrote, so uninstalling leaves nothing behind.
!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey SHCTX "Software\Classes\pone"
  DeleteRegKey SHCTX "Software\Classes\pguy"
  DeleteRegKey SHCTX "Software\Classes\Production Guy Project"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.pone"
  DeleteRegKey /ifempty SHCTX "Software\Classes\.pguy"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

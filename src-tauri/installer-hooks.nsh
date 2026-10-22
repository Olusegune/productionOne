; Gives .pone and .pguy documents their own icon (the application icon stays on the program itself).
!macro NSIS_HOOK_POSTINSTALL
  WriteRegStr SHCTX "Software\Classes\.pone" "" "Production One Project"
  WriteRegStr SHCTX "Software\Classes\Production One Project\DefaultIcon" "" "$INSTDIR\project-file.ico"
  WriteRegStr SHCTX "Software\Classes\Production Guy Project\DefaultIcon" "" "$INSTDIR\project-file.ico"
  WriteRegStr SHCTX "Software\Classes\pone\DefaultIcon" "" "$INSTDIR\project-file.ico"
  WriteRegStr SHCTX "Software\Classes\pguy\DefaultIcon" "" "$INSTDIR\project-file.ico"
  System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, p 0, p 0)'
!macroend

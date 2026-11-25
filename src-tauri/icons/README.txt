Icônes de l'application Sapphire CRM.

Fichiers présents (générés à partir de _source.png, 1024x1024) :
  - _source.png             source "S" sapphire (à remplacer par ton vrai logo si tu en as un)
  - 32x32.png, 128x128.png, 128x128@2x.png, icon.png   (PNG multi-tailles)
  - icon.ico                (Windows, multi-résolution 16..256)
  - icon.icns               (macOS)
  - Square*.png, StoreLogo.png   (tuiles Windows Store — utilisées par le bundler MSI/AppX)

Pour régénérer tous les formats à partir d'un PNG source :

  npx @tauri-apps/cli icon ./src-tauri/icons/_source.png

Cela remplira automatiquement tous les formats requis (y compris Android/iOS).

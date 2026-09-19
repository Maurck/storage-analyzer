# Instalación, actualización y datos de la beta

## Construir el instalador

En Windows, desde `modules/frontend`, con `npm ci` hecho y el JDK 17 de `.tools/java17` (o `JAVA_HOME` apuntando a un JDK 17 con `jmods`):

```powershell
npm run dist
```

El comando compila la interfaz, prueba y empaqueta el backend, crea con `jlink` un runtime de Java con solo los módulos que usa el backend y genera `dist/Storage-Analyzer-Setup-<versión>.exe` (unos 152 MiB). Para una segunda versión de prueba, por ejemplo para ensayar una actualización:

```powershell
npx electron-builder --win nsis --x64 -c.extraMetadata.version=1.0.0-beta.2 -c.directories.output=dist-update
```

## Qué incluye

| Parte                                    | Tamaño instalado |
| ---------------------------------------- | ---------------- |
| Electron 44 (ventana e interfaz)         | ~320 MiB         |
| Runtime de Java 17 recortado con `jlink` | 55 MiB           |
| Backend (`sa-backend.jar`)               | 19 MiB           |
| Total                                    | ~396 MiB         |

No hace falta Node, Java, Maven ni conexión a internet para instalar ni para analizar. El backend escucha solo en `127.0.0.1:5000`.

## Instalación

- Por usuario, sin permisos de administrador, en `%LOCALAPPDATA%\Programs\Storage Analyzer` por defecto; se puede elegir otra carpeta.
- Crea un acceso directo en el menú Inicio y otro en el escritorio.
- Instalación silenciosa para pruebas: `Storage-Analyzer-Setup-<versión>.exe /S /D=<carpeta>` (`/D` al final y sin comillas).

**Instalador sin firmar.** Si se descarga de internet, Windows SmartScreen avisa de un editor desconocido y hay que pulsar «Más información → Ejecutar de todas formas». No hay que desactivar ninguna protección, pero el aviso es una fricción real: antes de una distribución pública hace falta un certificado de firma de código. Un archivo copiado desde una unidad USB o una carpeta local no lleva la marca de descarga y no muestra el aviso.

## Datos que guarda

Todo queda en el equipo; la app no envía nada por red.

| Dato                                           | Dónde                                                           | Límite                                                            |
| ---------------------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------- |
| Idioma elegido y últimas 5 carpetas analizadas | `%APPDATA%\Storage Analyzer` (almacenamiento local de Electron) | 5 rutas                                                           |
| Registro del backend                           | `%APPDATA%\Storage Analyzer\logs\backend.log`                   | 5 MB; al superarlo pasa a `backend.old.log` y se empieza de nuevo |
| Resultados de los análisis                     | Solo en memoria del backend                                     | Se pierden al cerrar la app                                       |

Las rutas de las carpetas recientes y el registro pueden contener nombres de carpetas del usuario. Las carpetas recientes se pueden borrar desde la bienvenida.

## Actualización

Instalar una versión nueva encima de la anterior sustituye la app y conserva `%APPDATA%\Storage Analyzer`. La app y el backend se actualizan juntos, y el backend comprueba la versión de la API al arrancar (`/health`).

No hay actualización automática en la beta.

## Desinstalación

Desde «Aplicaciones instaladas» de Windows o con `Uninstall Storage Analyzer.exe /S`. Elimina la app, los accesos directos **y** `%APPDATA%\Storage Analyzer`, es decir, las carpetas recientes y los registros.

## Cierre y procesos

Al cerrar la ventana, la app detiene su backend. Si la app se termina a la fuerza, el backend lo detecta (vigila el proceso que lo inició) y se cierra también, así que no queda ningún proceso de Java ocupando el puerto.

## Limitaciones conocidas de la beta

- El puerto 5000 es fijo. Si otro programa lo usa, la app lo explica y no arranca su motor.
- Solo Windows x64. Se verificó en Windows 11 Pro; Windows 10 x64 debería funcionar, pero no se ha probado.
- Sin firma de código (ver arriba).

## Verificación automática

`modules/frontend/scripts/verify-install.ps1` instala, arranca sin herramientas de desarrollo en el `PATH`, analiza una carpeta con nombres Unicode, comprueba el cierre normal y el forzado, actualiza y desinstala. `modules/frontend/scripts/sandbox/start-sandbox.ps1` ejecuta lo mismo en Windows Sandbox, sin red y en un Windows limpio (hay que activar Windows Sandbox una vez, como administrador).

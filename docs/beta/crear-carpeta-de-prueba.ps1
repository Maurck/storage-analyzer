<#
.SYNOPSIS
    Crea (o elimina) la carpeta de prueba de las sesiones de la beta.

.DESCRIPTION
    Genera en Documentos una carpeta con archivos de relleno, sin datos
    personales, para que todas las sesiones usen las mismas tareas:

      - un archivo grande a seis niveles de profundidad (el objetivo de la tarea);
      - dos archivos con el mismo nombre en carpetas distintas;
      - varias fotos pequeñas y un instalador;
      - con -ConOmitidos, una carpeta sin permiso de lectura para ver un
        análisis parcial.

    Ocupa unos 1,4 GB de disco. No necesita permisos de administrador.
    Ejecuta con -Eliminar al terminar la sesión.

.EXAMPLE
    .\crear-carpeta-de-prueba.ps1 -ConOmitidos
.EXAMPLE
    .\crear-carpeta-de-prueba.ps1 -Eliminar
#>
[CmdletBinding()]
param(
    [string] $Destino = (Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Storage Analyzer - prueba'),
    [switch] $ConOmitidos,
    [switch] $Eliminar
)

$ErrorActionPreference = 'Stop'
$privado = Join-Path $Destino 'Privado'
$usuario = "$env:USERDOMAIN\$env:USERNAME"

function Quitar-Denegacion {
    if (Test-Path $privado) { icacls $privado /remove:d $usuario | Out-Null }
}

if ($Eliminar) {
    Quitar-Denegacion
    Remove-Item $Destino -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "Eliminada: $Destino"
    return
}

# Reserva el tamaño sin escribir su contenido, así que es casi instantáneo.
function Nuevo-Archivo([string] $ruta, [long] $bytes) {
    New-Item -ItemType Directory -Force (Split-Path $ruta) | Out-Null
    $stream = [IO.File]::Create($ruta)
    try { $stream.SetLength($bytes) } finally { $stream.Dispose() }
}

Quitar-Denegacion
Remove-Item $Destino -Recurse -Force -ErrorAction SilentlyContinue
$MB = 1MB
Nuevo-Archivo (Join-Path $Destino 'Proyectos\2023\cliente-a\entregas\final\render-final.mov') (700 * $MB)
Nuevo-Archivo (Join-Path $Destino 'Proyectos\2023\cliente-a\notas.txt') 12KB
Nuevo-Archivo (Join-Path $Destino 'Videos\vacaciones\video-familia.mp4') (250 * $MB)
Nuevo-Archivo (Join-Path $Destino 'Copias\2022\video-familia.mp4') (250 * $MB)
Nuevo-Archivo (Join-Path $Destino 'Descargas\instalador-programa.exe') (120 * $MB)
for ($i = 1; $i -le 40; $i++) {
    Nuevo-Archivo (Join-Path $Destino ("Fotos\viaje\IMG_{0:D4}.jpg" -f $i)) ((2 + $i % 4) * $MB)
}
Nuevo-Archivo (Join-Path $Destino 'Musica\lista.m3u') 2KB

if ($ConOmitidos) {
    Nuevo-Archivo (Join-Path $privado 'documento.pdf') (5 * $MB)
    # Solo afecta a esta carpeta y la quita -Eliminar.
    icacls $privado /deny "${usuario}:(OI)(CI)(R)" | Out-Null
}

Write-Host "Creada: $Destino"
Write-Host 'Objetivo de la tarea: render-final.mov (700 MB, seis niveles abajo).'

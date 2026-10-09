Add-Type -AssemblyName System.Drawing

$src = "C:\clario\apps\web\public\clario-logo.png"

function Resize-Image {
    param(
        [string]$srcPath,
        [string]$destPath,
        [int]$width,
        [int]$height
    )
    $srcImg = [System.Drawing.Image]::FromFile($srcPath)
    $destBitmap = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $graphics = [System.Drawing.Graphics]::FromImage($destBitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.DrawImage($srcImg, 0, 0, $width, $height)
    $destBitmap.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose()
    $destBitmap.Dispose()
    $srcImg.Dispose()
}

function Build-IcoFile {
    param(
        [string[]]$pngPaths,
        [string]$destIcoPath
    )
    $items = @()
    foreach ($p in $pngPaths) {
        $bytes = [System.IO.File]::ReadAllBytes($p)
        $img = [System.Drawing.Image]::FromFile($p)
        $w = if ($img.Width -ge 256) { [byte]0 } else { [byte]$img.Width }
        $h = if ($img.Height -ge 256) { [byte]0 } else { [byte]$img.Height }
        $img.Dispose()
        $items += [PSCustomObject]@{
            Width = $w
            Height = $h
            Bytes = $bytes
        }
    }

    $stream = [System.IO.File]::Create($destIcoPath)
    $writer = New-Object System.IO.BinaryWriter($stream)

    # Header
    $writer.Write([uint16]0)
    $writer.Write([uint16]1)
    $writer.Write([uint16]$items.Count)

    $offset = 6 + (16 * $items.Count)
    foreach ($item in $items) {
        $writer.Write([byte]$item.Width)
        $writer.Write([byte]$item.Height)
        $writer.Write([byte]0)
        $writer.Write([byte]0)
        $writer.Write([uint16]1)
        $writer.Write([uint16]32)
        $writer.Write([uint32]$item.Bytes.Length)
        $writer.Write([uint32]$offset)
        $offset += $item.Bytes.Length
    }

    foreach ($item in $items) {
        $writer.Write($item.Bytes)
    }

    $writer.Flush()
    $writer.Close()
    $stream.Close()
}

# 1. Generate temp PNGs for ICO
$temp16 = "C:\clario\apps\web\public\favicon-16x16.png"
$temp32 = "C:\clario\apps\web\public\favicon-32x32.png"
$temp48 = "C:\clario\apps\web\public\favicon-48x48.png"
$apple180 = "C:\clario\apps\web\public\apple-touch-icon.png"
$icon192 = "C:\clario\apps\web\public\icon-192.png"
$icon512 = "C:\clario\apps\web\public\icon-512.png"

Resize-Image $src $temp16 16 16
Resize-Image $src $temp32 32 32
Resize-Image $src $temp48 48 48
Resize-Image $src $apple180 180 180
Resize-Image $src $icon192 192 192
Resize-Image $src $icon512 512 512

# 2. Build multi-resolution ICO files
$publicIco = "C:\clario\apps\web\public\favicon.ico"
$appIco = "C:\clario\apps\web\src\app\favicon.ico"
Build-IcoFile @($temp16, $temp32, $temp48) $publicIco
Copy-Item $publicIco $appIco -Force

# 3. Next.js App Router icon and apple-icon
$appIcon = "C:\clario\apps\web\src\app\icon.png"
$appAppleIcon = "C:\clario\apps\web\src\app\apple-icon.png"
Resize-Image $src $appIcon 48 48
Resize-Image $src $appAppleIcon 180 180

# 4. Generate SVG with embedded authentic logo
$bytes512 = [System.IO.File]::ReadAllBytes($icon512)
$base64 = [Convert]::ToBase64String($bytes512)
$svgHeader = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" width="100%" height="100%">'
$svgImage = "  <image width=`"512`" height=`"512`" xlink:href=`"data:image/png;base64,$base64`" href=`"data:image/png;base64,$base64`" />"
$svgFooter = '</svg>'
$svgFinal = "$svgHeader`n$svgImage`n$svgFooter"
[System.IO.File]::WriteAllText("C:\clario\apps\web\public\clario-logo.svg", $svgFinal)
Copy-Item "C:\clario\apps\web\public\clario-logo.svg" "C:\clario\apps\web\src\app\icon.svg" -Force

Write-Host "Favicons and icons successfully generated!"

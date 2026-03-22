Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$dest = Join-Path $root 'icon128.png'
$bmp = New-Object System.Drawing.Bitmap 128, 128
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$rect = New-Object System.Drawing.Rectangle 0, 0, 128, 128
$c1 = [System.Drawing.Color]::FromArgb(255, 91, 163, 245)
$c2 = [System.Drawing.Color]::FromArgb(255, 124, 77, 214)
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $rect, $c1, $c2, 45
$g.FillRectangle($brush, $rect)
$brush.Dispose()
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::White), 3
$g.DrawLine($pen, 30, 70, 70, 70)
$g.DrawLine($pen, 38, 84, 92, 84)
# I-beam cursor (no font dependency)
$g.DrawLine($pen, 78, 52, 78, 92)
$g.DrawLine($pen, 72, 52, 84, 52)
$g.DrawLine($pen, 72, 92, 84, 92)
$g.Dispose()
$bmp.Save($dest, [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
Write-Host "Wrote $dest"

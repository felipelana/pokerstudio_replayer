param([string]$File, [int]$X, [int]$Y, [int]$W, [int]$H, [int]$Scale = 4, [string]$Out)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$src = [System.Drawing.Bitmap]::FromFile($File)
$r = New-Object System.Drawing.Rectangle $X, $Y, $W, $H
$crop = New-Object System.Drawing.Bitmap $W, $H
$g = [System.Drawing.Graphics]::FromImage($crop)
$g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $W, $H), $r, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()
$big = New-Object System.Drawing.Bitmap ($W * $Scale), ($H * $Scale)
$g2 = [System.Drawing.Graphics]::FromImage($big)
$g2.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$g2.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g2.DrawImage($crop, 0, 0, ($W * $Scale), ($H * $Scale))
# Ruler: a tick every 10 source px, brighter every 50.
$pen = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 0, 255, 0)), 1
$pen2 = New-Object System.Drawing.Pen ([System.Drawing.Color]::FromArgb(255, 255, 255, 0)), 1
$font = New-Object System.Drawing.Font 'Consolas', 9
$brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::Yellow)
for ($sy = 0; $sy -lt $H; $sy += 5) {
  $py = $sy * $Scale
  if ((($Y + $sy) % 20) -eq 0) {
    $g2.DrawLine($pen2, 0, $py, ($W * $Scale), $py)
    $g2.DrawString([string]($Y + $sy), $font, $brush, 2, $py)
  } else { $g2.DrawLine($pen, 0, $py, 30, $py) }
}
for ($sx = 0; $sx -lt $W; $sx += 5) {
  $px = $sx * $Scale
  if ((($X + $sx) % 20) -eq 0) {
    $g2.DrawLine($pen2, $px, 0, $px, ($H * $Scale))
    $g2.DrawString([string]($X + $sx), $font, $brush, $px, 2)
  }
}
$g2.Dispose()
$big.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
$crop.Dispose(); $big.Dispose(); $src.Dispose()
"saved $Out"

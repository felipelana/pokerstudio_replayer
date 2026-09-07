<#
  Turns the raw product screenshots into the assets the landing page ships.

  Every player nickname is pixelated and blurred until it is unreadable — on the
  table plates and in the action history — while cards, stacks, positions, pot
  sizes and every control stay exactly as they were captured. The untreated
  originals live in `_source/`, which is git-ignored and never published.

  Usage (from the landingpage folder):
      powershell -ExecutionPolicy Bypass -File scripts/prepare-assets.ps1

  Re-runnable: it always rebuilds from `_source/` and overwrites the output.
#>

param(
  [string]$SourceDir = (Join-Path $PSScriptRoot '..\_source'),
  [string]$OutDir    = (Join-Path $PSScriptRoot '..\src\assets\shots')
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

Add-Type -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class Redact {
  // Average the pixels inside a rectangle in square blocks, then smooth the
  // result. Pixelation destroys the glyph shapes; the blur removes the blocky
  // edges so the plate still reads as part of the interface.
  public static void Obscure(Bitmap bmp, Rectangle r, int block, int blurRadius, int passes) {
    r.Intersect(new Rectangle(0, 0, bmp.Width, bmp.Height));
    if (r.Width <= 0 || r.Height <= 0) return;

    BitmapData data = bmp.LockBits(r, ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int w = r.Width, h = r.Height, stride = data.Stride;
    byte[] buf = new byte[stride * h];
    System.Runtime.InteropServices.Marshal.Copy(data.Scan0, buf, 0, buf.Length);

    // 1. Pixelate.
    for (int by = 0; by < h; by += block) {
      for (int bx = 0; bx < w; bx += block) {
        int bw = Math.Min(block, w - bx), bh = Math.Min(block, h - by);
        long sb = 0, sg = 0, sr = 0, sa = 0;
        for (int y = by; y < by + bh; y++) {
          int row = y * stride;
          for (int x = bx; x < bx + bw; x++) {
            int i = row + x * 4;
            sb += buf[i]; sg += buf[i + 1]; sr += buf[i + 2]; sa += buf[i + 3];
          }
        }
        int n = bw * bh;
        byte ab = (byte)(sb / n), ag = (byte)(sg / n), ar = (byte)(sr / n), aa = (byte)(sa / n);
        for (int y = by; y < by + bh; y++) {
          int row = y * stride;
          for (int x = bx; x < bx + bw; x++) {
            int i = row + x * 4;
            buf[i] = ab; buf[i + 1] = ag; buf[i + 2] = ar; buf[i + 3] = aa;
          }
        }
      }
    }

    // 2. Box blur, repeated — three passes approximate a Gaussian.
    byte[] tmp = new byte[buf.Length];
    for (int p = 0; p < passes; p++) {
      Array.Copy(buf, tmp, buf.Length);
      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          int y0 = Math.Max(0, y - blurRadius), y1 = Math.Min(h - 1, y + blurRadius);
          int x0 = Math.Max(0, x - blurRadius), x1 = Math.Min(w - 1, x + blurRadius);
          long sb = 0, sg = 0, sr = 0, sa = 0; int n = 0;
          for (int yy = y0; yy <= y1; yy++) {
            int row = yy * stride;
            for (int xx = x0; xx <= x1; xx++) {
              int i = row + xx * 4;
              sb += tmp[i]; sg += tmp[i + 1]; sr += tmp[i + 2]; sa += tmp[i + 3]; n++;
            }
          }
          int o = y * stride + x * 4;
          buf[o] = (byte)(sb / n); buf[o + 1] = (byte)(sg / n);
          buf[o + 2] = (byte)(sr / n); buf[o + 3] = (byte)(sa / n);
        }
      }
    }

    System.Runtime.InteropServices.Marshal.Copy(buf, 0, data.Scan0, buf.Length);
    bmp.UnlockBits(data);
  }

  public static Bitmap Crop(Bitmap src, Rectangle r) {
    r.Intersect(new Rectangle(0, 0, src.Width, src.Height));
    Bitmap outp = new Bitmap(r.Width, r.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(outp)) {
      g.DrawImage(src, new Rectangle(0, 0, r.Width, r.Height), r, GraphicsUnit.Pixel);
    }
    return outp;
  }

  public static Bitmap ResizeToWidth(Bitmap src, int width) {
    if (src.Width <= width) return new Bitmap(src);
    int height = (int)Math.Round(src.Height * (width / (double)src.Width));
    Bitmap outp = new Bitmap(width, height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(outp)) {
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.DrawImage(src, 0, 0, width, height);
    }
    return outp;
  }

  public static void SaveJpeg(Bitmap bmp, string path, long quality) {
    ImageCodecInfo codec = null;
    foreach (ImageCodecInfo c in ImageCodecInfo.GetImageEncoders())
      if (c.MimeType == "image/jpeg") codec = c;
    EncoderParameters ps = new EncoderParameters(1);
    ps.Param[0] = new EncoderParameter(Encoder.Quality, quality);
    // Flatten onto black: the interface is dark, and JPEG has no alpha.
    using (Bitmap flat = new Bitmap(bmp.Width, bmp.Height, PixelFormat.Format24bppRgb))
    using (Graphics g = Graphics.FromImage(flat)) {
      g.Clear(Color.Black);
      g.DrawImageUnscaled(bmp, 0, 0);
      flat.Save(path, codec, ps);
    }
  }
}
'@ -ReferencedAssemblies System.Drawing, System.Windows.Forms

function New-Rect([int]$x, [int]$y, [int]$w, [int]$h) { New-Object System.Drawing.Rectangle $x, $y, $w, $h }
function From-Box([int]$x0, [int]$y0, [int]$x1, [int]$y1) { New-Rect $x0 $y0 ($x1 - $x0) ($y1 - $y0) }

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir -Force | Out-Null }

# --- Where the nicknames are, in the native pixels of each capture -----------
# Table plates and the whole nickname column of the action history.
$redactions = @{
  'shot-replayer.png' = @(
    (From-Box 1046  252 1154  282),   # hitman12449
    (From-Box  826  294  938  324),   # pardalnegro
    (From-Box 1312  324 1404  354),   # penske428
    (From-Box  660  413  776  443),   # avalanche091
    (From-Box 1482  413 1564  443),   # 77-NEXUS-77
    (From-Box  754  596  859  626),   # 117bono117
    (From-Box 1076  686 1159  716),   # TheLIPE7
    (From-Box  330  896  462 1036)    # nickname column of the action history
  )
  'shot-review.png' = @(
    (From-Box  908  252 1018  282),   # hitman12449
    (From-Box  686  294  800  324),   # pardalnegro
    (From-Box 1174  324 1268  354),   # penske428
    (From-Box  520  413  640  443),   # avalanche091
    (From-Box 1306  413 1354  443),   # 77-NEXUS-77 (partly behind the panel)
    (From-Box  614  596  722  626),   # 117bono117
    (From-Box  938  686 1022  716),   # TheLIPE7
    (From-Box  318  896  452 1036)    # nickname column of the action history
  )
  'shot-skins.png' = @(
    (From-Box 1050  340 1122  372),   # -luury
    (From-Box 1242  340 1332  372),   # Saludfresh
    (From-Box  864  378  948  410),   # LastSeat
    (From-Box  880  610  952  642),   # shogi2
    (From-Box 1160  697 1212  729),   # Hero
    (From-Box 1502  509 1590  541)    # Player Four
  )
}

# --- What gets cut out of each capture --------------------------------------
# fullWidth: the whole (treated) capture, resized. crops: detail shots.
$outputs = @{
  'shot-replayer.png' = @{
    full  = @{ name = 'replayer-full'; width = 1600; jpeg = $true }
    crops = @(
      @{ name = 'crop-hand-list';  box = (From-Box    0  398  314 1070); jpeg = $false }
      @{ name = 'crop-table';      box = (From-Box  600  170 1680  790); jpeg = $true  }
      @{ name = 'crop-timeline';   box = (From-Box  318  890 1945 1073); jpeg = $false }
      @{ name = 'crop-filters';    box = (From-Box    0   96  314  440); jpeg = $false }
    )
  }
  'shot-review.png' = @{
    full  = @{ name = 'review-full'; width = 1600; jpeg = $true }
    crops = @(
      # Deliberately starts below the old star widget: the scale is 0-100 now.
      @{ name = 'crop-review-panel';   box = (From-Box 1644  160 1934  512); jpeg = $false }
      @{ name = 'crop-street-notes';   box = (From-Box 1644  512 1934  790); jpeg = $false }
      @{ name = 'crop-display-panel';  box = (From-Box 1336  112 1584  540); jpeg = $false }
    )
  }
  'shot-skins.png' = @{
    full  = @{ name = 'skins-full'; width = 1600; jpeg = $true }
    crops = @(
      @{ name = 'crop-skin-editor';  box = (From-Box    0   44  398 1069); jpeg = $false }
      @{ name = 'crop-deck';         box = (From-Box  408   52  990  186); jpeg = $false }
      @{ name = 'crop-languages';    box = (From-Box 1548   44 1786  342); jpeg = $false }
    )
  }
}

foreach ($file in $outputs.Keys | Sort-Object) {
  $path = Join-Path $SourceDir $file
  if (-not (Test-Path $path)) { throw "Missing source capture: $path" }

  $original = [System.Drawing.Bitmap]::FromFile($path)
  $bmp = New-Object System.Drawing.Bitmap $original
  $original.Dispose()

  foreach ($r in $redactions[$file]) {
    [Redact]::Obscure($bmp, $r, 9, 6, 3)
  }

  $spec = $outputs[$file]
  $full = [Redact]::ResizeToWidth($bmp, $spec.full.width)
  $fullPath = Join-Path $OutDir ("{0}.jpg" -f $spec.full.name)
  [Redact]::SaveJpeg($full, $fullPath, 86)
  "  {0} -> {1}x{2}" -f (Split-Path $fullPath -Leaf), $full.Width, $full.Height
  $full.Dispose()

  foreach ($c in $spec.crops) {
    $crop = [Redact]::Crop($bmp, $c.box)
    if ($c.jpeg) {
      $p = Join-Path $OutDir ("{0}.jpg" -f $c.name)
      [Redact]::SaveJpeg($crop, $p, 88)
    } else {
      $p = Join-Path $OutDir ("{0}.png" -f $c.name)
      $crop.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
    }
    "  {0} -> {1}x{2}" -f (Split-Path $p -Leaf), $crop.Width, $crop.Height
    $crop.Dispose()
  }

  # A treated full-size copy, so the redaction can be audited without the originals.
  $bmp.Dispose()
}

# --- Logo --------------------------------------------------------------------
$logoSrc = Join-Path $SourceDir 'logo-original.png'
if (Test-Path $logoSrc) {
  $logoOut = Join-Path (Split-Path $OutDir -Parent) 'brand'
  if (-not (Test-Path $logoOut)) { New-Item -ItemType Directory -Path $logoOut -Force | Out-Null }
  $logo = [System.Drawing.Bitmap]::FromFile($logoSrc)
  foreach ($w in 512, 128) {
    $r = [Redact]::ResizeToWidth($logo, $w)
    $p = Join-Path $logoOut ("pokerstudio-mark-{0}.png" -f $w)
    $r.Save($p, [System.Drawing.Imaging.ImageFormat]::Png)
    "  {0} -> {1}x{2}" -f (Split-Path $p -Leaf), $r.Width, $r.Height
    $r.Dispose()
  }
  $logo.Dispose()
}

'Done.'

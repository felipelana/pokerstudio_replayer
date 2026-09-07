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
# Each box covers the name line of a seat plate only: the stack sits on the line
# below and stays readable, as do the position badge, the cards and every
# control. The last box of each table capture covers the nickname column of the
# action history, stopping short of the verb ("raises to 2.5 BB" stays).
# The two table captures are the same render; the review one is shifted 138 px
# left because the review panel narrows the stage.
$redactions = @{
  'shot-replayer.png' = @(
    (From-Box 1050  256 1152  274),   # hitman12449
    (From-Box  828  297  924  315),   # pardalnegro
    (From-Box 1316  326 1400  344),   # penske428
    (From-Box  662  416  772  434),   # avalanche091
    (From-Box 1484  416 1562  434),   # 77-NEXUS-77
    (From-Box  756  600  856  618),   # 117bono117
    (From-Box 1080  690 1156  708),   # TheLIPE7
    # Action history, one box per line, each only as wide as that nickname.
    (From-Box  337  896  423  913),   # 77-NEXUS-77 (clipped line)
    (From-Box  337  913  401  933),   # TheLIPE7
    (From-Box  337  933  416  953),   # 117bono117
    (From-Box  337  953  430  973),   # avalanche091
    (From-Box  337  973  423  993),   # pardalnegro
    (From-Box  337  993  423 1013),   # hitman12449
    (From-Box  337 1013  408 1034)    # penske428
  )
  'shot-review.png' = @(
    (From-Box  912  256 1014  274),   # hitman12449
    (From-Box  690  297  786  315),   # pardalnegro
    (From-Box 1178  326 1262  344),   # penske428
    (From-Box  524  416  634  434),   # avalanche091
    (From-Box 1313  416 1346  434),   # 77-NEXUS-77 (mostly behind the popover)
    (From-Box  618  600  718  618),   # 117bono117
    (From-Box  942  690 1018  708),   # TheLIPE7
    # Same action history, 11 px further left.
    (From-Box  326  896  412  913),   # 77-NEXUS-77 (clipped line)
    (From-Box  326  913  390  933),   # TheLIPE7
    (From-Box  326  933  405  953),   # 117bono117
    (From-Box  326  953  419  973),   # avalanche091
    (From-Box  326  973  412  993),   # pardalnegro
    (From-Box  326  993  412 1013),   # hitman12449
    (From-Box  326 1013  397 1034)    # penske428
  )
  'shot-skins.png' = @(
    (From-Box 1057  345 1107  363),   # -luury
    (From-Box 1248  345 1325  363),   # Saludfresh
    (From-Box  872  383  938  401),   # LastSeat
    (From-Box  894  616  948  634),   # shogi2
    (From-Box 1163  703 1203  721),   # Hero
    (From-Box 1505  514 1583  532)    # Player Four
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
    # No full-window output on purpose: the top of the review panel still shows
    # the old five-star widget, and the scale is 0-100 now. Only crops taken
    # from below it are published.
    full  = @{ name = 'review-full'; width = 1600; jpeg = $true; skip = $true }
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
    [Redact]::Obscure($bmp, $r, 6, 5, 3)
  }

  $spec = $outputs[$file]
  if (-not $spec.full.skip) {
    $full = [Redact]::ResizeToWidth($bmp, $spec.full.width)
    $fullPath = Join-Path $OutDir ("{0}.jpg" -f $spec.full.name)
    [Redact]::SaveJpeg($full, $fullPath, 86)
    "  {0} -> {1}x{2}" -f (Split-Path $fullPath -Leaf), $full.Width, $full.Height
    $full.Dispose()
  }

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

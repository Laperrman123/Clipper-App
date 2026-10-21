<#
  Generator aset tema "Shinobi" (Naruto-style) â€” sepenuhnya prosedural (GDI+).
  Tidak butuh file biner dari luar; jalankan ulang kapan pun untuk regenerasi.

  Pakai dari root project:
    powershell -ExecutionPolicy Bypass -File scripts\generate-naruto-assets.ps1
#>

param(
  [string]$OutDir = ''
)

Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($OutDir)) {
  $OutDir = Join-Path (Split-Path -Parent $PSScriptRoot) 'src\assets\naruto'
}
$OutDir = [System.IO.Path]::GetFullPath($OutDir)
if (-not (Test-Path -LiteralPath $OutDir)) {
  New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

# ---------------------------------------------------------------- palet
$C = @{
  bgDeep   = [System.Drawing.Color]::FromArgb(255, 3, 7, 5)
  bg       = [System.Drawing.Color]::FromArgb(255, 7, 13, 10)
  surface  = [System.Drawing.Color]::FromArgb(255, 15, 30, 23)
  surface2 = [System.Drawing.Color]::FromArgb(255, 22, 41, 31)
  surface3 = [System.Drawing.Color]::FromArgb(255, 31, 58, 43)
  orange   = [System.Drawing.Color]::FromArgb(255, 249, 115, 22)
  orangeHi = [System.Drawing.Color]::FromArgb(255, 255, 192, 97)
  orangeLo = [System.Drawing.Color]::FromArgb(255, 169, 78, 13)
  red      = [System.Drawing.Color]::FromArgb(255, 220, 38, 38)
  leaf     = [System.Drawing.Color]::FromArgb(255, 111, 174, 91)
  text     = [System.Drawing.Color]::FromArgb(255, 247, 243, 232)
  textMuted = [System.Drawing.Color]::FromArgb(255, 169, 163, 140)
  textFaint = [System.Drawing.Color]::FromArgb(255, 114, 108, 92)
  borderStrong = [System.Drawing.Color]::FromArgb(255, 58, 90, 68)
  mist     = [System.Drawing.Color]::FromArgb(255, 196, 214, 199)
}

# ---------------------------------------------------------------- helpers
function Alpha([int]$a, [System.Drawing.Color]$c) {
  return [System.Drawing.Color]::FromArgb($a, $c.R, $c.G, $c.B)
}

function New-Canvas([int]$w, [int]$h) {
  $bmp = [System.Drawing.Bitmap]::new($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)
  return @{ Bitmap = $bmp; Graphics = $g }
}

function Save-Canvas($canvas, [string]$name) {
  $canvas.Graphics.Dispose()
  $path = Join-Path $OutDir $name
  $canvas.Bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $canvas.Bitmap.Dispose()
  $size = (Get-Item -LiteralPath $path).Length
  Write-Host ("  {0,-28} {1,9:N0} bytes" -f $name, $size)
}

function New-RoundedRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $d = $r * 2
  $p.AddArc($x, $y, $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $p.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $p.CloseFigure()
  return $p
}

function New-LinearGradient([single]$x, [single]$y, [single]$w, [single]$h, [System.Drawing.Color]$c1, [System.Drawing.Color]$c2, [single]$angle = 90) {
  $rect = [System.Drawing.RectangleF]::new($x, $y, $w, $h)
  return [System.Drawing.Drawing2D.LinearGradientBrush]::new($rect, $c1, $c2, $angle)
}

function Draw-Glow([System.Drawing.Graphics]$g, [single]$cx, [single]$cy, [single]$r, [System.Drawing.Color]$color) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddEllipse([single]($cx - $r), [single]($cy - $r), [single]($r * 2), [single]($r * 2))
  $pgb = [System.Drawing.Drawing2D.PathGradientBrush]::new($path)
  $pgb.CenterPoint = [System.Drawing.PointF]::new($cx, $cy)
  $pgb.CenterColor = $color
  $trans = [System.Drawing.Color]::FromArgb(0, $color.R, $color.G, $color.B)
  $pgb.SurroundColors = [System.Drawing.Color[]]@($trans)
  $g.FillPath($pgb, $path)
  $pgb.Dispose()
  $path.Dispose()
}

function New-LeafPath([single]$w, [single]$h) {
  $p = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $hw = $w / 2
  $hh = $h / 2
  $p.AddBezier([single]0, [single](-$hh), [single]($hw * 1.12), [single](-$hh * 0.36), [single]($hw * 1.12), [single]($hh * 0.36), [single]0, [single]$hh)
  $p.AddBezier([single]0, [single]$hh, [single](-$hw * 1.12), [single]($hh * 0.36), [single](-$hw * 1.12), [single](-$hh * 0.36), [single]0, [single](-$hh))
  $p.CloseFigure()
  return $p
}

function Draw-Leaf([System.Drawing.Graphics]$g, [single]$cx, [single]$cy, [single]$w, [single]$h, [single]$angle, $fill, $pen, [int]$veinAlpha = 110) {
  $state = $g.Save()
  $g.TranslateTransform($cx, $cy)
  $g.RotateTransform($angle)
  $path = New-LeafPath $w $h
  if ($null -ne $fill) { $g.FillPath($fill, $path) }
  if ($null -ne $pen) { $g.DrawPath($pen, $path) }
  $path.Dispose()
  if ($veinAlpha -gt 0) {
    $vp = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb($veinAlpha, 22, 34, 22), [single]1.6)
    $g.DrawLine($vp, [single]0, [single](-$h / 2 + 3), [single]0, [single]($h / 2 - 3))
    for ($i = -2; $i -le 2; $i++) {
      $yy = $i * ($h / 6)
      $g.DrawLine($vp, [single]0, [single]$yy, [single]($w * 0.22), [single]($yy - $h * 0.08))
      $g.DrawLine($vp, [single]0, [single]$yy, [single](-$w * 0.22), [single]($yy - $h * 0.08))
    }
    $vp.Dispose()
  }
  $g.Restore($state)
}

function Draw-Spiral([System.Drawing.Graphics]$g, [single]$cx, [single]$cy, [single]$maxR, [single]$turns, [System.Drawing.Pen]$pen) {
  $pts = [System.Collections.Generic.List[System.Drawing.PointF]]::new()
  $steps = 340
  for ($i = 0; $i -le $steps; $i++) {
    $t = $i / $steps
    $th = $t * $turns * 2 * [Math]::PI
    $r = $maxR * $t
    $x = [single]($cx + $r * [Math]::Cos($th))
    $y = [single]($cy + $r * [Math]::Sin($th))
    $pts.Add([System.Drawing.PointF]::new($x, $y))
  }
  $g.DrawCurve($pen, $pts.ToArray())
}

function Draw-Trunk([System.Drawing.Graphics]$g, [single]$x, [single]$w, [single]$top, [single]$bottom, [System.Drawing.Color]$color, [single]$lean = 0) {
  $hw = $w / 2
  $pts = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new([single]($x + $lean - $hw * 0.52), $top),
    [System.Drawing.PointF]::new([single]($x + $lean + $hw * 0.52), $top),
    [System.Drawing.PointF]::new([single]($x + $hw), $bottom),
    [System.Drawing.PointF]::new([single]($x - $hw), $bottom)
  )
  $b = [System.Drawing.SolidBrush]::new($color)
  $g.FillPolygon($b, $pts)
  $b.Dispose()
}

function Draw-Branch([System.Drawing.Graphics]$g, [single]$x1, [single]$y1, [single]$x2, [single]$y2, [single]$width, [System.Drawing.Color]$color) {
  $pen = [System.Drawing.Pen]::new($color, $width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $g.DrawLine($pen, $x1, $y1, $x2, $y2)
  $pen.Dispose()
}

function Draw-Shuriken([System.Drawing.Graphics]$g, [single]$cx, [single]$cy, [single]$r, [System.Drawing.Pen]$pen) {
  $k = $r * 0.24
  $pts = [System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new($cx, [single]($cy - $r)),
    [System.Drawing.PointF]::new([single]($cx + $k), [single]($cy - $k)),
    [System.Drawing.PointF]::new([single]($cx + $r), $cy),
    [System.Drawing.PointF]::new([single]($cx + $k), [single]($cy + $k)),
    [System.Drawing.PointF]::new($cx, [single]($cy + $r)),
    [System.Drawing.PointF]::new([single]($cx - $k), [single]($cy + $k)),
    [System.Drawing.PointF]::new([single]($cx - $r), $cy),
    [System.Drawing.PointF]::new([single]($cx - $k), [single]($cy - $k))
  )
  $g.DrawPolygon($pen, $pts)
}

function Draw-Vignette([System.Drawing.Graphics]$g, [single]$w, [single]$h, [int]$alpha = 175) {
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $path.AddRectangle([System.Drawing.RectangleF]::new(0, 0, $w, $h))
  $pgb = [System.Drawing.Drawing2D.PathGradientBrush]::new($path)
  $pgb.CenterPoint = [System.Drawing.PointF]::new([single]($w / 2), [single]($h * 0.45))
  $pgb.CenterColor = [System.Drawing.Color]::FromArgb(0, 0, 0, 0)
  $pgb.SurroundColors = [System.Drawing.Color[]]@([System.Drawing.Color]::FromArgb($alpha, 0, 0, 0))
  $g.FillRectangle($pgb, [single]0, [single]0, $w, $h)
  $pgb.Dispose()
  $path.Dispose()
}

# Menggambar mark utama (spiral + daun) di tengah kanvas.
function Draw-Mark([System.Drawing.Graphics]$g, [single]$cx, [single]$cy, [single]$scale) {
  Draw-Glow $g $cx $cy ([single](190 * $scale)) (Alpha 95 $C.orange)
  Draw-Glow $g $cx $cy ([single](110 * $scale)) (Alpha 80 $C.orangeHi)

  $sp1 = [System.Drawing.Pen]::new((Alpha 235 $C.orange), [single](16 * $scale))
  $sp1.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $sp1.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  Draw-Spiral $g $cx $cy ([single](150 * $scale)) 2.6 $sp1
  $sp1.Dispose()

  $sp2 = [System.Drawing.Pen]::new((Alpha 130 $C.orangeHi), [single](5.5 * $scale))
  $sp2.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $sp2.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  Draw-Spiral $g $cx $cy ([single](112 * $scale)) 2.9 $sp2
  $sp2.Dispose()

  $lw = [single](150 * $scale)
  $lh = [single](212 * $scale)
  $lx = [single]($cx + 46 * $scale)
  $ly = [single]($cy - 54 * $scale)
  $fill = New-LinearGradient ([single]($lx - $lw / 2)) ([single]($ly - $lh / 2)) $lw $lh (Alpha 248 $C.orangeHi) (Alpha 238 $C.orange) 55
  Draw-Leaf $g $lx $ly $lw $lh -32 $fill (Alpha 90 $C.orangeLo) 120
  $fill.Dispose()
}

Write-Host "Membuat aset Shinobi di $OutDir"

# ================================================================ 1. logo mark
$cv = New-Canvas 512 512
$g = $cv.Graphics
$bg = New-LinearGradient 0 0 512 512 (Alpha 255 $C.surface2) $C.bgDeep 90
$rr = New-RoundedRect 0 0 512 512 116
$g.FillPath($bg, $rr)
$bg.Dispose()
$ringPath = New-RoundedRect 16 16 480 480 100
$ring = [System.Drawing.Pen]::new((Alpha 80 $C.surface3), [single]6)
$g.DrawPath($ring, $ringPath)
$ring.Dispose(); $ringPath.Dispose()
Draw-Mark $g 250 256 1.0
Save-Canvas $cv 'logo-mark.png'

# ================================================================ 2. hero pattern
# Gaya poster sinematik: siluet hutan, bulan, pusaran chakra, bara. Sengaja
# dibuat "flat poster" (bukan realistis) supaya bersih di ukuran kartu.
$cv = New-Canvas 1200 900
$g = $cv.Graphics

$sky = New-LinearGradient 0 0 1200 900 (Alpha 255 ([System.Drawing.Color]::FromArgb(255, 18, 48, 38))) (Alpha 255 ([System.Drawing.Color]::FromArgb(255, 2, 6, 4))) 90
$g.FillRectangle($sky, 0, 0, 1200, 900)
$sky.Dispose()

# halo bulan + pusaran chakra
Draw-Glow $g 900 210 380 (Alpha 30 ([System.Drawing.Color]::FromArgb(255, 255, 222, 164)))
Draw-Glow $g 520 330 400 (Alpha 22 $C.orange)
Draw-Glow $g 520 330 220 (Alpha 18 $C.red)

$skySp = [System.Drawing.Pen]::new((Alpha 24 $C.red), [single]26)
$skySp.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$skySp.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
Draw-Spiral $g 520 330 300 2.25 $skySp
$skySp.Dispose()

$moon = [System.Drawing.SolidBrush]::new((Alpha 64 ([System.Drawing.Color]::FromArgb(255, 255, 240, 205))))
$g.FillEllipse($moon, 848, 158, 104, 104)
$moon.Dispose()

# --- hutan jauh: deretan batang tipis (siluet) ---
$farTrunk = [System.Drawing.Color]::FromArgb(255, 5, 15, 10)
$i = 0
foreach ($t in @(
    @(30, 14, 560, 6), @(128, 10, 610, -4), @(222, 18, 520, 8),
    @(318, 9, 640, -6), @(412, 15, 585, 5), @(512, 11, 620, -8),
    @(618, 19, 545, 7), @(716, 10, 630, -5), @(812, 16, 575, 9),
    @(910, 12, 645, -7), @(1004, 18, 560, 6), @(1102, 10, 615, -5),
    @(1188, 15, 585, 8)
  )) {
  Draw-Trunk $g ([single]$t[0]) ([single]$t[1]) ([single]$t[2]) 900 $farTrunk ([single]$t[3])
  $i++
}

# --- daun besar di sudut atas: bingkai komposisi ---
$frameLeaf = [System.Drawing.SolidBrush]::new((Alpha 240 ([System.Drawing.Color]::FromArgb(255, 6, 19, 12))))
foreach ($lf in @(
    @(-10, 30, 190, 260, 34), @(96, -10, 158, 220, 58), @(206, -46, 150, 214, 82),
    @(1006, -30, 172, 244, -42), @(1112, 16, 160, 224, -66), @(1210, 74, 138, 196, -88),
    @(-24, 856, 196, 268, -26), @(70, 906, 176, 246, -8)
  )) {
  Draw-Leaf $g ([single]$lf[0]) ([single]$lf[1]) ([single]$lf[2]) ([single]$lf[3]) ([single]$lf[4]) $frameLeaf $null 0
}
$frameLeaf.Dispose()

# --- bukit: kurva halus ---
$ridge = [System.Drawing.PointF[]]@(
  [System.Drawing.PointF]::new(-40, 806),
  [System.Drawing.PointF]::new(130, 764),
  [System.Drawing.PointF]::new(300, 792),
  [System.Drawing.PointF]::new(470, 752),
  [System.Drawing.PointF]::new(640, 786),
  [System.Drawing.PointF]::new(810, 748),
  [System.Drawing.PointF]::new(980, 784),
  [System.Drawing.PointF]::new(1140, 752),
  [System.Drawing.PointF]::new(1250, 778)
)
$hill = [System.Drawing.Drawing2D.GraphicsPath]::new()
$hill.AddCurve($ridge)
$hill.AddLines([System.Drawing.PointF[]]@(
    [System.Drawing.PointF]::new([single]1250, [single]920),
    [System.Drawing.PointF]::new([single]-40, [single]920)
  ))
$hill.CloseFigure()
$hillBrush = New-LinearGradient 0 730 1200 190 (Alpha 255 ([System.Drawing.Color]::FromArgb(255, 7, 20, 14))) (Alpha 255 ([System.Drawing.Color]::FromArgb(255, 2, 6, 4))) 90
$g.FillPath($hillBrush, $hill)
$hillBrush.Dispose()
$hill.Dispose()

# --- kabut rendah: gradasi dua tahap, alpha rendah ---
$fogA = New-LinearGradient 0 748 1200 64 ([System.Drawing.Color]::FromArgb(0, 150, 186, 160)) ([System.Drawing.Color]::FromArgb(16, 150, 186, 160)) 90
$g.FillRectangle($fogA, 0, 748, 1200, 64)
$fogA.Dispose()
$fogB = New-LinearGradient 0 812 1200 88 ([System.Drawing.Color]::FromArgb(16, 150, 186, 160)) ([System.Drawing.Color]::FromArgb(0, 150, 186, 160)) 90
$g.FillRectangle($fogB, 0, 812, 1200, 88)
$fogB.Dispose()

# --- bara chakra ---
$rnd = [System.Random]::new(20261020)
for ($n = 0; $n -lt 40; $n++) {
  $x = [single]$rnd.Next(60, 1140)
  $y = [single]($rnd.Next(470, 840) + $rnd.NextDouble() * 30)
  $r = [single](1.3 + $rnd.NextDouble() * 2.0)
  Draw-Glow $g $x $y ([single]($r * 4.0)) (Alpha 28 $C.orange)
  $dot = [System.Drawing.SolidBrush]::new((Alpha 185 $C.orangeHi))
  $g.FillEllipse($dot, [single]($x - $r / 2), [single]($y - $r / 2), $r, $r)
  $dot.Dispose()
}

Draw-Vignette $g 1200 900 200
Save-Canvas $cv 'hero-pattern.png'

# ================================================================ 3. background texture (seamless)
$cv = New-Canvas 256 256
$g = $cv.Graphics
$pOrange = [System.Drawing.Pen]::new((Alpha 120 $C.orange), [single]2.2)
$pGreen = [System.Drawing.Pen]::new((Alpha 85 $C.leaf), [single]2.0)
$pRed = [System.Drawing.Pen]::new((Alpha 75 $C.red), [single]1.9)

$motifs = @(
  @{ x = 42;  y = 46;  w = 32; h = 46; a = -32; p = $pOrange },
  @{ x = 152; y = 34;  w = 25; h = 37; a = 24;  p = $pGreen },
  @{ x = 214; y = 124; w = 36; h = 50; a = 62;  p = $pOrange },
  @{ x = 98;  y = 154; w = 29; h = 43; a = -12; p = $pGreen },
  @{ x = 34;  y = 198; w = 23; h = 33; a = 38;  p = $pRed },
  @{ x = 170; y = 210; w = 33; h = 45; a = -58; p = $pOrange }
)
foreach ($m in $motifs) {
  for ($dx = -256; $dx -le 256; $dx += 256) {
    for ($dy = -256; $dy -le 256; $dy += 256) {
      Draw-Leaf $g ([single]($m.x + $dx)) ([single]($m.y + $dy)) ([single]$m.w) ([single]$m.h) ([single]$m.a) $null $m.p 0
    }
  }
}
$pOrange.Dispose(); $pGreen.Dispose(); $pRed.Dispose()

$pShuriken = [System.Drawing.Pen]::new((Alpha 95 $C.orangeHi), [single]1.8)
foreach ($pt in @(@(122, 96), @(206, 66), @(28, 118), @(150, 240))) {
  for ($dx = -256; $dx -le 256; $dx += 256) {
    for ($dy = -256; $dy -le 256; $dy += 256) {
      Draw-Shuriken $g ([single]($pt[0] + $dx)) ([single]($pt[1] + $dy)) 9 $pShuriken
    }
  }
}
$pShuriken.Dispose()
Save-Canvas $cv 'background-texture.png'

# ================================================================ 4. launcher icon (legacy square)
$cv = New-Canvas 512 512
$g = $cv.Graphics
$bg = New-LinearGradient 0 0 512 512 (Alpha 255 ([System.Drawing.Color]::FromArgb(255, 20, 44, 32))) $C.bgDeep 90
$g.FillRectangle($bg, 0, 0, 512, 512)
$bg.Dispose()
Draw-Mark $g 250 256 1.08
Save-Canvas $cv 'launcher-icon.png'

# ================================================================ 5. adaptive foreground (transparan, safe zone)
$cv = New-Canvas 432 432
$g = $cv.Graphics
Draw-Mark $g 210 216 0.56
Save-Canvas $cv 'launcher-foreground.png'

# ================================================================ 6. corner ornament
$cv = New-Canvas 320 320
$g = $cv.Graphics
$swirl = [System.Drawing.Pen]::new((Alpha 120 $C.orange), [single]5)
$swirl.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$swirl.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
Draw-Spiral $g 96 224 82 1.7 $swirl
$swirl.Dispose()

$idx = 0
foreach ($spec in @(@(70,150,44,64,-38), @(120,110,52,74,-18), @(178,82,46,66,6), @(232,64,38,56,28), @(150,168,34,50,40))) {
  $a = 70
  if ($idx % 2 -eq 0) { $fillCol = Alpha 95 $C.orange } else { $fillCol = Alpha 80 $C.leaf }
  $penCol = Alpha 130 $C.orangeHi
  $fill = [System.Drawing.SolidBrush]::new($fillCol)
  $pen = [System.Drawing.Pen]::new($penCol, [single]1.6)
  Draw-Leaf $g ([single]$spec[0]) ([single]$spec[1]) ([single]$spec[2]) ([single]$spec[3]) ([single]$spec[4]) $fill $pen 0
  $fill.Dispose(); $pen.Dispose()
  $idx++
}
Save-Canvas $cv 'corner-ornament.png'

# ================================================================ 7. chakra ring
$cv = New-Canvas 512 512
$g = $cv.Graphics
Draw-Glow $g 256 256 240 (Alpha 70 $C.orange)
Draw-Glow $g 256 256 170 (Alpha 55 $C.orangeHi)

$ringPen = [System.Drawing.Pen]::new((Alpha 200 $C.orange), [single]13)
$ringPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$ringPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawEllipse($ringPen, 96, 96, 320, 320)
$ringPen.Dispose()

$innerPen = [System.Drawing.Pen]::new((Alpha 90 $C.orangeHi), [single]3)
$g.DrawEllipse($innerPen, 122, 122, 268, 268)
$g.DrawEllipse($innerPen, 74, 74, 364, 364)
$innerPen.Dispose()

# tick marks
$tickPen = [System.Drawing.Pen]::new((Alpha 150 $C.orangeHi), [single]4)
$tickPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
for ($i = 0; $i -lt 24; $i++) {
  $th = $i * (2 * [Math]::PI / 24)
  $r1 = 156.0
  $r2 = 168.0
  $x1 = [single](256 + $r1 * [Math]::Cos($th))
  $y1 = [single](256 + $r1 * [Math]::Sin($th))
  $x2 = [single](256 + $r2 * [Math]::Cos($th))
  $y2 = [single](256 + $r2 * [Math]::Sin($th))
  $g.DrawLine($tickPen, $x1, $y1, $x2, $y2)
}
$tickPen.Dispose()
Save-Canvas $cv 'chakra-ring.png'

# ================================================================ 8. empty state illustration
$cv = New-Canvas 480 480
$g = $cv.Graphics
$framePen = [System.Drawing.Pen]::new((Alpha 150 $C.textMuted), [single]5)
$frame = New-RoundedRect 84 132 312 216 28
$g.DrawPath($framePen, $frame)
$frame.Dispose()

# perforasi film
$perf = [System.Drawing.SolidBrush]::new((Alpha 120 $C.textMuted))
for ($i = 0; $i -lt 5; $i++) {
  $yy = 160 + $i * 40
  $g.FillRectangle($perf, 100, $yy, 14, 18)
  $g.FillRectangle($perf, 366, $yy, 14, 18)
}
$perf.Dispose()

# garis potong putus-putus
$dashPen = [System.Drawing.Pen]::new((Alpha 170 $C.orange), [single]4)
$dashPen.DashStyle = [System.Drawing.Drawing2D.DashStyle]::Dash
$g.DrawLine($dashPen, 120, 336, 368, 152)
$dashPen.Dispose()

# daun di tengah
$leafFill = [System.Drawing.SolidBrush]::new((Alpha 225 $C.orange))
$leafPen = [System.Drawing.Pen]::new((Alpha 200 $C.orangeHi), [single]2.4)
Draw-Leaf $g 250 238 92 132 -24 $leafFill $leafPen 150
$leafFill.Dispose(); $leafPen.Dispose()

# percikan
$spark = [System.Drawing.Pen]::new((Alpha 130 $C.red), [single]3)
Draw-Shuriken $g 128 208 16 $spark
Draw-Shuriken $g 356 246 13 $spark
$spark.Dispose()
Save-Canvas $cv 'empty-state.png'

# ================================================================ 9. divider
$cv = New-Canvas 800 48
$g = $cv.Graphics
$linePen = [System.Drawing.Pen]::new((Alpha 110 $C.borderStrong), [single]2)
$g.DrawLine($linePen, 0, 24, 336, 24)
$g.DrawLine($linePen, 464, 24, 800, 24)
$linePen.Dispose()

$dot = [System.Drawing.SolidBrush]::new((Alpha 150 $C.orange))
$g.FillEllipse($dot, 344, 20, 8, 8)
$g.FillEllipse($dot, 448, 20, 8, 8)
$dot.Dispose()

$leafFill = [System.Drawing.SolidBrush]::new((Alpha 230 $C.orange))
$leafPen = [System.Drawing.Pen]::new((Alpha 220 $C.orangeHi), [single]1.8)
Draw-Leaf $g 400 24 26 36 90 $leafFill $leafPen 0
$leafFill.Dispose(); $leafPen.Dispose()
Save-Canvas $cv 'divider.png'

Write-Host "Selesai."

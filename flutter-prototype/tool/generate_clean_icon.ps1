Add-Type -AssemblyName System.Drawing

$srcPath = (Resolve-Path "assets/crop agro logo.PNG").Path
$srcBmp = [System.Drawing.Bitmap]::new($srcPath)

# Emblem crop rect: X=104, Y=16, Width=360, Height=360
$cropX = 104
$cropY = 16
$cropW = 360
$cropH = 360

# 1. Create a 1024x1024 high-res master app icon
$masterSize = 1024
$masterBmp = New-Object System.Drawing.Bitmap($masterSize, $masterSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($masterBmp)
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.Clear([System.Drawing.Color]::White)

# Draw the cropped emblem with a subtle safe-area margin (e.g. 880x880 inside 1024x1024 for adaptive icon padding)
$margin = 48
$targetSize = $masterSize - ($margin * 2)
$destRect = New-Object System.Drawing.Rectangle($margin, $margin, $targetSize, $targetSize)
$srcRect = New-Object System.Drawing.Rectangle($cropX, $cropY, $cropW, $cropH)

$g.DrawImage($srcBmp, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$g.Dispose()

$masterPath = (Resolve-Path "assets").Path + "\app_icon.png"
$masterBmp.Save($masterPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created Master Icon: $masterPath (1024x1024)"

# 2. Also create an adaptive icon foreground (transparent background with emblem centered for Android 8+)
$fgBmp = New-Object System.Drawing.Bitmap(1024, 1024, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$fgG = [System.Drawing.Graphics]::FromImage($fgBmp)
$fgG.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$fgG.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
$fgG.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$fgG.Clear([System.Drawing.Color]::Transparent)

# Android adaptive icon safe zone is 66% of 1024 = 676px
$adaptiveSize = 720
$adaptiveMargin = (1024 - $adaptiveSize) / 2
$destAdaptive = New-Object System.Drawing.Rectangle($adaptiveMargin, $adaptiveMargin, $adaptiveSize, $adaptiveSize)
$fgG.DrawImage($srcBmp, $destAdaptive, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
$fgG.Dispose()

$fgPath = (Resolve-Path "assets").Path + "\app_icon_foreground.png"
$fgBmp.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Host "Created Adaptive Foreground: $fgPath"

$srcBmp.Dispose()
$masterBmp.Dispose()
$fgBmp.Dispose()

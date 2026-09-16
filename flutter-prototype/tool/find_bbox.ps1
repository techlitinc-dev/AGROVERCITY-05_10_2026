Add-Type -AssemblyName System.Drawing

$srcPath = (Resolve-Path "assets/crop agro logo.PNG").Path
$bmp = [System.Drawing.Bitmap]::new($srcPath)

Write-Host "Image Size: $($bmp.Width) x $($bmp.Height)"

# Find the bounding box of the top green emblem
# The text "Agrovercity" is near the bottom.
# Let's inspect pixel colors across rows to find where the green emblem ends and where the text starts.

$emblemMinX = $bmp.Width
$emblemMinY = $bmp.Height
$emblemMaxX = 0
$emblemMaxY = 0

for ($y = 0; $y -lt [int]($bmp.Height * 0.78); $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
        $c = $bmp.GetPixel($x, $y)
        # If not white background
        if ($c.R -lt 240 -or $c.G -lt 240 -or $c.B -lt 240) {
            if ($x -lt $emblemMinX) { $emblemMinX = $x }
            if ($x -gt $emblemMaxX) { $emblemMaxX = $x }
            if ($y -lt $emblemMinY) { $emblemMinY = $y }
            if ($y -gt $emblemMaxY) { $emblemMaxY = $y }
        }
    }
}

Write-Host "Emblem Bounding Box: X=$emblemMinX, Y=$emblemMinY, MaxX=$emblemMaxX, MaxY=$emblemMaxY"
$emblemW = $emblemMaxX - $emblemMinX
$emblemH = $emblemMaxY - $emblemMinY
Write-Host "Emblem Width: $emblemW, Height: $emblemH"

$bmp.Dispose()

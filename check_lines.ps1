$c = [IO.File]::ReadAllText('E:\onespace_personal\frontend\js\app.js')
$lines = $c.Split("`n")
for ($i = 7820; $i -le 7835; $i++) {
    if ($i -le $lines.Count) {
        Write-Host ("{0}: {1}" -f $i, $lines[$i-1])
    }
}
# Para processos Node à escuta nas portas habituais do monorepo (dev).
$ports = 3000, 3001, 3010, 3020
foreach ($port in $ports) {
  $conns = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  foreach ($c in $conns) {
    $procId = $c.OwningProcess
    Write-Host "Porta $port -> PID $procId"
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
  }
}
Write-Host "Portas libertadas (se havia processos)."

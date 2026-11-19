# =============================================================================
#  Bot da Karen Martins Cosméticos • Instalador no Windows 11
# -----------------------------------------------------------------------------
#  Abra o "Terminal (Administrador)" (botão direito no Iniciar) e cole:
#
#    irm https://raw.githubusercontent.com/alvesjardimitalo-oss/italo-alves-ti/main/karen-bot/windows/instalar-karen-bot.ps1 | iex
#
#  O que ele faz (pode rodar de novo; não apaga nada):
#    1. instala Node.js e Git (winget), se faltarem
#    2. baixa só a pasta karen-bot do GitHub
#    3. abre o Bloco de Notas para colar as variáveis (.env) — reaproveita a chave do
#       Firebase do bot do High OS, se ela já estiver neste PC
#    4. liga o bot sozinho quando você entra no Windows e reinicia se cair
#    5. cria a pasta "Karen Bot" na Área de Trabalho com Status/Log/Reiniciar/Parar/Atualizar
#  Não precisa de Tailscale nem de endereço público: o bot só conversa com o Discord e o Firebase.
#  Nenhum segredo fica neste arquivo nem no GitHub.
# =============================================================================
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}

$Repo    = 'https://github.com/alvesjardimitalo-oss/italo-alves-ti.git'
$Base    = Join-Path $env:LOCALAPPDATA 'KarenBot'
$Clone   = Join-Path $Base 'repo'
$App     = Join-Path $Clone 'karen-bot'
$Dados   = Join-Path $Base 'dados'
$Logs    = Join-Path $Base 'logs'
$Runner  = Join-Path $Base 'executar.ps1'
$Manage  = Join-Path $Base 'gerenciar.ps1'
$Task    = 'Karen Bot'
$Port    = 3100
$EnvFile = Join-Path $Base '.env'
$HighOsEnv = Join-Path $env:LOCALAPPDATA 'HighOS\high-os-discord\.env'
$Utf8    = New-Object System.Text.UTF8Encoding($false)

function Passo([string]$t){ Write-Host ''; Write-Host "▶ $t" -ForegroundColor Magenta }
function Ok([string]$t){ Write-Host "  ✔ $t" -ForegroundColor Green }
function Aviso([string]$t){ Write-Host "  ! $t" -ForegroundColor Yellow }
function Falha([string]$t){ Write-Host "  ✖ $t" -ForegroundColor Red; throw $t }
function Atualizar-Path { $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User') }
function Checar([string]$msg){ if ($LASTEXITCODE -ne 0) { Falha $msg } }
function Instalar([string]$id, [string]$nome) {
  Write-Host "  instalando $nome..."
  winget install --id $id -e --silent --accept-package-agreements --accept-source-agreements --disable-interactivity | Out-Null
  Atualizar-Path
}

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Falha 'Abra o "Terminal (Administrador)": botão direito no Iniciar > Terminal (Administrador). Depois cole o comando de novo.' }
New-Item -ItemType Directory -Force -Path $Base, $Dados, $Logs | Out-Null

# ---------------------------------------------------------------------------
Passo '1/5 Programas (Node.js e Git)'
Atualizar-Path
$nodeOk = $false
if (Get-Command node -ErrorAction SilentlyContinue) { $nodeOk = [int]((& node -p 'process.versions.node.split(".")[0]')) -ge 20 }
if (-not $nodeOk) {
  if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { Falha 'winget não encontrado. Atualize o "Instalador de Aplicativo" pela Microsoft Store e tente de novo.' }
  Instalar 'OpenJS.NodeJS.LTS' 'Node.js'
}
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Instalar 'Git.Git' 'Git' }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) { Falha 'O Node.js não ficou disponível. Feche o Terminal, abra de novo como Administrador e rode o comando outra vez.' }
if (-not (Get-Command git -ErrorAction SilentlyContinue)) { Falha 'O Git não ficou disponível. Feche o Terminal, abra de novo como Administrador e rode o comando outra vez.' }
Ok ("Node " + (& node -v) + " e " + (& git --version) + ".")

# ---------------------------------------------------------------------------
Passo '2/5 Código do bot'
function Parar-Bot {
  try { Stop-ScheduledTask -TaskName $Task -ErrorAction SilentlyContinue } catch {}
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*karen-bot*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*KarenBot*executar.ps1*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
Parar-Bot
if (Test-Path (Join-Path $Clone '.git')) {
  git -C $Clone pull --ff-only; Checar 'Não consegui atualizar o código (git pull).'
} else {
  git clone --depth 1 --filter=blob:none --sparse $Repo $Clone; Checar 'Não consegui baixar o código do GitHub.'
  git -C $Clone sparse-checkout set karen-bot; Checar 'Não consegui separar a pasta do bot.'
}
Push-Location $App
try {
  & npm.cmd install --omit=dev --no-audit --no-fund --loglevel=error; Checar 'Falha ao instalar as dependências (npm install).'
  & npm.cmd run -s check; Checar 'O código do bot não passou na conferência (npm run check).'
} finally { Pop-Location }
Ok ('Bot baixado: ' + (git -C $Clone log -1 --format='%h %s'))

# ---------------------------------------------------------------------------
Passo '3/5 Variáveis do bot (.env)'
function Valor([string]$arquivo, [string]$chave) {
  if (-not (Test-Path $arquivo)) { return '' }
  $l = Get-Content -Path $arquivo -Encoding UTF8 | Where-Object { $_ -match "^\s*$chave\s*=" } | Select-Object -First 1
  if ($l) { return ($l -replace "^\s*$chave\s*=\s*", '').Trim() } else { return '' }
}
function Completo { (Valor $EnvFile 'DISCORD_TOKEN') -and (Valor $EnvFile 'DISCORD_GUILD_ID') -and (Valor $EnvFile 'FIREBASE_SERVICE_ACCOUNT_JSON') }
if (-not (Completo)) {
  $firebase = Valor $EnvFile 'FIREBASE_SERVICE_ACCOUNT_JSON'
  if (-not $firebase) { $firebase = Valor $HighOsEnv 'HIGH_OS_FIREBASE_SERVICE_ACCOUNT_JSON'; if ($firebase) { Ok 'Chave do Firebase reaproveitada do bot do High OS.' } }
  if (-not $firebase) {
    # Chave baixada do Console do Firebase (Contas de serviço > Gerar nova chave privada) na pasta Downloads.
    $arq = Get-ChildItem -Path (Join-Path $env:USERPROFILE 'Downloads') -Filter '*.json' -ErrorAction SilentlyContinue |
      Where-Object { $_.Name -like '*firebase-adminsdk*' -or $_.Name -like 'high-os-*' } | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($arq) {
      try { $j = Get-Content $arq.FullName -Raw -Encoding UTF8 | ConvertFrom-Json
        if ($j.client_email -and $j.private_key) { $firebase = ($j | ConvertTo-Json -Compress -Depth 5); Ok ('Chave do Firebase lida de ' + $arq.Name + ' (Downloads).') } }
      catch { Aviso ('Não consegui ler ' + $arq.Name) }
    } else {
      Aviso 'Sem chave do Firebase neste PC. Gere em: console.firebase.google.com > projeto high-os > Configurações do projeto > Contas de serviço > Gerar nova chave privada.'
      Aviso 'Deixe o arquivo baixado na pasta Downloads e rode este instalador de novo (ele lê sozinho).'
    }
  }
  $modelo = @(
    '# Preencha depois do sinal de = (sem espaços nem aspas). Depois: Ctrl+S e FECHE o Bloco de Notas.',
    '# Token: Discord Developer Portal > seu app > Bot > Reset Token',
    ('DISCORD_TOKEN=' + (Valor $EnvFile 'DISCORD_TOKEN')),
    '# ID do servidor: no Discord, botão direito no ícone do servidor > Copiar ID do servidor',
    ('DISCORD_GUILD_ID=' + (Valor $EnvFile 'DISCORD_GUILD_ID')),
    '# Chave da conta de serviço do Firebase (projeto high-os), numa linha só',
    ('FIREBASE_SERVICE_ACCOUNT_JSON=' + $firebase),
    "PORT=$Port"
  )
  [IO.File]::WriteAllLines($EnvFile, $modelo, $Utf8)
  for ($i = 1; $i -le 3 -and -not (Completo); $i++) {
    Write-Host '  Abrindo o Bloco de Notas: preencha, salve (Ctrl+S) e feche.' -ForegroundColor Cyan
    Start-Process notepad.exe -ArgumentList "`"$EnvFile`"" -Wait
    if (-not (Completo)) { Aviso 'Ainda falta DISCORD_TOKEN, DISCORD_GUILD_ID ou FIREBASE_SERVICE_ACCOUNT_JSON. Vamos abrir de novo.' }
  }
  if (-not (Completo)) { Falha "Variáveis não preenchidas. Edite $EnvFile e rode o instalador de novo." }
} else { Ok "Variáveis já existem (mantidas). Para editar: notepad `"$EnvFile`"" }
Copy-Item $EnvFile (Join-Path $App '.env') -Force
Ok 'Variáveis salvas (ficam só no seu PC).'

# Bot antigo do High OS (métricas): não é mais usado. Oferece remover do PC.
$TarefaHighOs = Get-ScheduledTask -TaskName 'HighOS Bot' -ErrorAction SilentlyContinue
$PastaHighOs  = Join-Path $env:LOCALAPPDATA 'HighOS'
if ($TarefaHighOs -or (Test-Path $PastaHighOs)) {
  $r = Read-Host '  Encontrei o bot do High OS (métricas) neste PC. Remover de vez? (tarefa, atalhos e arquivos) [S/N]'
  if ($r -match '^[sS]') {
    try { Stop-ScheduledTask -TaskName 'HighOS Bot' -ErrorAction SilentlyContinue } catch {}
    Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -like '*high-os-discord*' -or $_.CommandLine -match '^\S*node(\.exe)?"?\s+src[\\/]index\.js' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { $_.CommandLine -like '*HighOS*executar.ps1*' } |
      ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    if ($TarefaHighOs) { Unregister-ScheduledTask -TaskName 'HighOS Bot' -Confirm:$false -ErrorAction SilentlyContinue }
    $Ts = Join-Path $env:ProgramFiles 'Tailscale\tailscale.exe'
    if (Test-Path $Ts) { try { & $Ts funnel reset 2>$null | Out-Null } catch {} }
    Remove-Item (Join-Path ([Environment]::GetFolderPath('Desktop')) 'High OS Bot') -Recurse -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Remove-Item $PastaHighOs -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path $PastaHighOs) { Aviso "Não consegui apagar $PastaHighOs inteira (algum arquivo em uso). Apague depois pelo Explorador." } else { Ok 'Bot do High OS removido do PC.' }
    Write-Host '  (O Tailscale continua instalado; se não usar mais, desinstale em Configurações > Aplicativos.)'
  }
}

# ---------------------------------------------------------------------------
Passo '4/5 Ligar sozinho com o Windows'
$runnerTxt = @"
# Gerado pelo instalador do Bot da Karen. Mantém o bot rodando e reinicia se cair.
`$App  = '$App'
`$Log  = '$(Join-Path $Logs 'bot.log')'
`$Old  = '$(Join-Path $Logs 'bot.anterior.log')'
`$env:KAREN_BOT_DATA = '$Dados'
Set-Location `$App
while (`$true) {
  if ((Test-Path `$Log) -and ((Get-Item `$Log).Length -gt 10MB)) { Move-Item `$Log `$Old -Force }
  Copy-Item '$EnvFile' (Join-Path `$App '.env') -Force -ErrorAction SilentlyContinue
  Add-Content -Path `$Log -Encoding UTF8 -Value ("[" + (Get-Date -Format s) + "] iniciando bot")
  cmd /c "node ""`$App\src\index.js"" >> ""`$Log"" 2>&1"
  Add-Content -Path `$Log -Encoding UTF8 -Value ("[" + (Get-Date -Format s) + "] bot parou (codigo " + `$LASTEXITCODE + "); reiniciando em 10s")
  Start-Sleep -Seconds 10
}
"@
[IO.File]::WriteAllText($Runner, $runnerTxt, (New-Object System.Text.UTF8Encoding($true)))
$usuario = "$env:USERDOMAIN\$env:USERNAME"
$acao    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Runner`""
$gatilho = New-ScheduledTaskTrigger -AtLogOn -User $usuario
$config  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$quem    = New-ScheduledTaskPrincipal -UserId $usuario -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $Task -Action $acao -Trigger $gatilho -Settings $config -Principal $quem -Force | Out-Null
Start-ScheduledTask -TaskName $Task
$vivo = $false
for ($i = 0; $i -lt 30 -and -not $vivo; $i++) {
  Start-Sleep -Seconds 3
  try { $h = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 5; $vivo = [bool]$h.ok } catch {}
}
if (-not $vivo) { Falha ("O bot não respondeu. Veja o log: " + (Join-Path $Logs 'bot.log')) }
Ok "Bot rodando (tarefa '$Task') · papel: $($h.papel) · Firebase: $($h.firebase)"
if ($h.papel -eq 'reserva') { Ok 'Outro PC já está com o bot: este fica de reserva e assume se aquele parar.' }

# ---------------------------------------------------------------------------
Passo '5/5 Atalhos'
$manageTxt = @"
# Gerado pelo instalador do Bot da Karen.
param([string]`$Acao = 'status')
`$Clone = '$Clone'; `$App = '$App'; `$Task = '$Task'; `$Port = $Port; `$Log = '$(Join-Path $Logs 'bot.log')'
function Parar { Stop-ScheduledTask -TaskName `$Task -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { `$_.CommandLine -like '*karen-bot*' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" | Where-Object { `$_.CommandLine -like '*KarenBot*executar.ps1*' } | ForEach-Object { Stop-Process -Id `$_.ProcessId -Force -ErrorAction SilentlyContinue } }
function Status { Write-Host ('Tarefa: ' + (Get-ScheduledTask -TaskName `$Task).State)
  try { `$h = Invoke-RestMethod "http://127.0.0.1:`$Port/health" -TimeoutSec 8
    Write-Host ("Este PC: " + `$h.pc + " · papel: " + `$h.papel + " (reserva = esperando; assume se o outro PC parar)") -ForegroundColor Cyan
    Write-Host ("Bot respondendo · Discord: " + `$h.discordReady + " · Firebase: " + `$h.firebase + " · servidor montado: " + `$h.servidorMontado + " · grupos: " + `$h.grupos) -ForegroundColor Green
    if (`$h.ultimoErro) { Write-Host ("Último erro: " + `$h.ultimoErro) -ForegroundColor Yellow } }
  catch { Write-Host 'SEM RESPOSTA: o bot não está rodando. Use Reiniciar e veja o log.' -ForegroundColor Red } }
switch (`$Acao) {
  'log'       { Get-Content `$Log -Tail 80 -Wait -Encoding UTF8 }
  'reiniciar' { Parar; Start-ScheduledTask -TaskName `$Task; Start-Sleep 10; Status }
  'parar'     { Parar; Write-Host 'Bot parado. Ele volta quando você entrar no Windows de novo (ou use Reiniciar).' }
  'atualizar' { Parar; git -C `$Clone pull --ff-only; Push-Location `$App; npm.cmd install --omit=dev --no-audit --no-fund --loglevel=error; npm.cmd run -s check; Pop-Location; Start-ScheduledTask -TaskName `$Task; Start-Sleep 10; Status }
  'variaveis' { notepad '$EnvFile'; Write-Host 'Depois de salvar, use Reiniciar.' }
  default     { Status }
}
"@
[IO.File]::WriteAllText($Manage, $manageTxt, (New-Object System.Text.UTF8Encoding($true)))
$pasta = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Karen Bot'
New-Item -ItemType Directory -Force -Path $pasta | Out-Null
$atalhos = [ordered]@{ 'Status' = 'status'; 'Ver log' = 'log'; 'Reiniciar' = 'reiniciar'; 'Parar' = 'parar'; 'Atualizar' = 'atualizar'; 'Editar variaveis' = 'variaveis' }
foreach ($nome in $atalhos.Keys) {
  $cmd = "@echo off`r`npowershell -NoProfile -ExecutionPolicy Bypass -File `"$Manage`" $($atalhos[$nome])`r`npause`r`n"
  [IO.File]::WriteAllText((Join-Path $pasta "$nome.cmd"), $cmd, (New-Object System.Text.ASCIIEncoding))
}
Ok "Pasta 'Karen Bot' criada na Área de Trabalho."
Write-Host ''
Write-Host '  PRONTO! Agora, no Discord, digite /servidor montar no servidor do High OS.' -ForegroundColor Green

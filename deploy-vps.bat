@echo off
REM ═══════════════════════════════════════════
REM G5X MASTER OS - Deploy MANUAL para VPS
REM ═══════════════════════════════════════════
REM Este script SÓ deve ser executado quando o usuário solicitar
REM "atualizar VPS" ou "deploy para VPS"

echo.
echo ========================================
echo   DEPLOY MANUAL - PC para VPS
echo ========================================
echo.
echo [ATENCAO] Este script enviara arquivos para a VPS!
echo.

REM Verificar controle de sincronização
if exist .sync-control (
    findstr "STATUS=DESATIVADO" .sync-control >nul
    if %errorlevel% equ 0 (
        echo [BLOQUEADO] Sincronia esta DESATIVADA!
        echo.
        echo Para liberar o deploy, edite .sync-control e mude para STATUS=LIBERADO
        echo Ou execute com a flag --force
        echo.
        if "%1"=="--force" (
            echo [FORCA] Liberando deploy temporariamente...
        ) else (
            pause
            exit /b 1
        )
    )
)

REM Verificar se Docker está instalado
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker nao encontrado.
    pause
    exit /b 1
)

echo [OK] Iniciando deploy manual...
echo.

REM Criar backup local antes do deploy
echo [BACKUP] Criando backup local...
set BACKUP_DIR=backup_%date:/=-%_%time::=-%
set BACKUP_DIR=%BACKUP_DIR: =%
mkdir "%BACKUP_DIR%" 2>nul
xcopy "public\index.html" "%BACKUP_DIR%\" /Y >nul
xcopy "api.js" "%BACKUP_DIR%\" /Y >nul
xcopy "server.js" "%BACKUP_DIR%\" /Y >nul
echo [OK] Backup criado em: %BACKUP_DIR%
echo.

REM Instruções para deploy
echo [PASSOS PARA DEPLOY MANUAL]
echo.
echo 1. Copie os arquivos para a VPS:
echo    scp -r g5x-agent-system/* root@SEU_IP:/opt/g5x-agent-system/
echo.
echo 2. Ou use rsync (recomendado):
echo    rsync -avz --exclude 'node_modules' --exclude '.env' g5x-agent-system/ root@SEU_IP:/opt/g5x-agent-system/
echo.
echo 3. Na VPS, reinicie os containers:
echo    ssh root@SEU_IP "cd /opt/g5x-agent-system && docker-compose up -d --build"
echo.
echo 4. Verifique o health check:
echo    curl http://SEU_IP:3000/health
echo.
echo [DICA] Substitua SEU_IP pelo IP real da sua VPS
echo.
pause

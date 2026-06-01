@echo off
REM ═══════════════════════════════════════════
REM G5X MASTER OS - Deploy Script (Windows)
REM ═══════════════════════════════════════════

echo.
echo ========================================
echo   G5X MASTER OS - Deploy na VPS
echo ========================================
echo.

REM Verificar se Docker está instalado
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker nao encontrado. Instale o Docker Desktop primeiro.
    pause
    exit /b 1
)

REM Verificar se Docker Compose está instalado
docker-compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Docker Compose nao encontrado.
    pause
    exit /b 1
)

echo [OK] Docker e Docker Compose encontrados
echo.

REM Criar .env se não existir
if not exist .env (
    echo [AVISO] Arquivo .env nao encontrado. Copiando do exemplo...
    copy .env.example .env
    echo.
    echo [INFO] Edite o arquivo .env com suas credenciais antes de continuar!
    echo.
    pause
    exit /b 1
)

echo [INFO] Construindo containers...
echo.
docker-compose up -d --build

echo.
echo [OK] Deploy concluido!
echo.
echo [INFO] Status dos containers:
docker-compose ps

echo.
echo [INFO] Acesse o CRM em: http://localhost:3000
echo.
echo [INFO] Comandos uteis:
echo    Ver logs: docker-compose logs -f
echo    Parar: docker-compose down
echo    Reiniciar: docker-compose restart
echo.
echo [INFO] Health check: curl http://localhost:3000/health
echo.
pause

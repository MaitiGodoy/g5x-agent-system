@echo off
REM ═══════════════════════════════════════════
REM G5X MASTER OS - ENVIAR PARA GITHUB
REM ═══════════════════════════════════════════

echo.
echo ========================================
echo   ENVIAR PARA GITHUB - G5X MASTER OS
echo ========================================
echo.

REM Verificar se Git está instalado
where git >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Git nao esta instalado!
    echo.
    echo Para instalar:
    echo 1. Acesse: https://git-scm.com/download/win
    echo 2. Baixe e instale o Git
    echo 3. Execute este script novamente
    echo.
    pause
    exit /b 1
)

echo [OK] Git encontrado!
echo.

cd "C:\Users\user\Downloads\g5x antigracity\g5x-agent-system"

REM Verificar se já é um repositório git
if not exist ".git" (
    echo [INIT] Inicializando repositorio Git...
    git init
    echo.
)

echo [CONFIG] Configure seu nome e email do GitHub:
echo.
set /p GIT_NAME="Seu nome: "
set /p GIT_EMAIL="Seu email: "

git config user.name "%GIT_NAME%"
git config user.email "%GIT_EMAIL%"

echo.
echo [ADD] Adicionando arquivos...
git add .

echo.
echo [COMMIT] Criando commit...
git commit -m "v25-estavel - versão funcionando perfeitamente (16/05/2026)"

echo.
echo [REMOTE] Configure o repositório no GitHub:
echo.
echo 1. Acesse: https://github.com/new
echo 2. Crie um repositorio chamado: g5x-agent-system
echo 3. Nao marque 'Initialize with README'
echo 4. Copie a URL do repositorio criado
echo.
set /p GITHUB_URL="Cole a URL do repositorio (ex: https://github.com/usuario/g5x-agent-system.git): "

if "%GITHUB_URL%"=="" (
    echo [ERRO] URL nao fornecida!
    pause
    exit /b 1
)

git remote add origin "%GITHUB_URL%"
git branch -M main

echo.
echo [PUSH] Enviando para o GitHub...
git push -u origin main

echo.
echo [OK] Enviado com sucesso!
echo.
echo Seu codigo esta seguro no GitHub!
echo.
pause

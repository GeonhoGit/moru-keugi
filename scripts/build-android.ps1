<#
.SYNOPSIS
  안드로이드 APK를 빌드하고 (선택적으로) 기기에 설치한다.

.DESCRIPTION
  이 프로젝트는 한글이 들어간 경로에 있어 그 자리에서는 네이티브 빌드가 불가능하다.
  Android Gradle Plugin이 비ASCII 경로를 거부하고, 그 검사를 넘겨도 NDK의 clang이
  한글이 섞인 `-I` 경로를 처리하지 못해 expo-modules-core의 C++ 컴파일에서 깨진다.
  디렉터리 junction도 Gradle이 실제 경로로 되돌려 해석해 소용없다.

  그래서 ASCII 경로로 사본을 만들어 거기서 빌드한다.
  근본 해결은 프로젝트를 `C:\dev\moru` 같은 ASCII 경로로 옮기는 것이다.
  경로에 한글이 없으면 이 스크립트는 사본 없이 제자리에서 빌드한다.

.PARAMETER Variant
  Debug 또는 Release. 기본값 Release (Metro 없이 단독 실행된다).

.PARAMETER Install
  빌드 후 연결된 기기에 설치한다.

.EXAMPLE
  .\scripts\build-android.ps1 -Install
#>
param(
  [ValidateSet('Debug', 'Release')]
  [string]$Variant = 'Release',
  [switch]$Install,
  [string]$WorkDir = "$env:USERPROFILE\moru-app"
)

$ErrorActionPreference = 'Stop'
# 한글 로그가 깨지지 않게 콘솔 출력을 UTF-8로 맞춘다.
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch {}
$projectRoot = Split-Path -Parent $PSScriptRoot

# Windows PowerShell 5.1은 네이티브 exe가 stderr로 한 줄만 흘려도 그것을 오류로 취급한다.
# expo/gradle은 정상 동작 중에도 경고를 stderr로 내보내므로, 네이티브 호출 동안에는
# 이 승격을 끄고 종료 코드로만 성공 여부를 판단한다.
function Invoke-Native {
  param([scriptblock]$Command, [string]$What)
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    & $Command
    if ($LASTEXITCODE -ne 0) { throw "$What 실패 (종료 코드 $LASTEXITCODE)" }
  } finally {
    $ErrorActionPreference = $previous
  }
}

function Find-Jdk17 {
  if ($env:JAVA_HOME -and (Test-Path "$env:JAVA_HOME\bin\java.exe")) { return $env:JAVA_HOME }
  $candidates = @(
    'E:\Java\jdk-17.0.19+10',
    'C:\Program Files\Java\jdk-17',
    'C:\Program Files\Eclipse Adoptium\jdk-17'
  )
  foreach ($c in $candidates) { if (Test-Path "$c\bin\java.exe") { return $c } }
  throw 'JDK 17을 찾지 못했습니다. JAVA_HOME을 설정하세요.'
}

function Find-Adb {
  $sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { $env:ANDROID_SDK_ROOT }
  if (-not $sdk) { throw 'ANDROID_HOME이 설정되어 있지 않습니다.' }
  $adb = Join-Path $sdk 'platform-tools\adb.exe'
  if (-not (Test-Path $adb)) { throw "adb를 찾지 못했습니다: $adb" }
  return $adb
}

# 경로에 ASCII가 아닌 문자가 있는지 확인한다.
$needsCopy = $projectRoot -cmatch '[^\x00-\x7F]'

if ($needsCopy) {
  Write-Host "경로에 비ASCII 문자가 있어 ASCII 경로로 사본을 만듭니다: $WorkDir" -ForegroundColor Yellow

  # /XD 에 폴더 이름만 적으면 node_modules 안의 같은 이름 폴더까지 전부 빠진다.
  # 반드시 전체 경로로 적어야 한다.
  $exclude = @(
    (Join-Path $projectRoot '.git'),
    (Join-Path $projectRoot '.expo'),
    (Join-Path $projectRoot 'android'),
    (Join-Path $projectRoot 'ios'),
    (Join-Path $projectRoot '.expo-export-check')
  )
  robocopy $projectRoot $WorkDir /E /NFL /NDL /NJH /NJS /NP /MT:16 /XD @exclude | Out-Null
  # robocopy는 0~7을 성공으로 쓴다.
  if ($LASTEXITCODE -ge 8) { throw "복사에 실패했습니다 (robocopy $LASTEXITCODE)" }
  $buildRoot = $WorkDir
} else {
  $buildRoot = $projectRoot
}

Push-Location $buildRoot
try {
  # 이전 빌드의 Gradle 데몬이 산출물 파일을 잡고 있으면
  # `prebuild --clean`이 android 폴더를 지우지 못하고 EBUSY로 실패한다.
  # 데몬 종료만으로는 잠금이 바로 풀리지 않는 경우가 있어, 폴더를 직접 지운다.
  $existingAndroid = Join-Path $buildRoot 'android'
  if (Test-Path $existingAndroid) {
    Write-Host '이전 네이티브 산출물을 정리합니다...' -ForegroundColor DarkGray
    $gradlew = Join-Path $existingAndroid 'gradlew.bat'
    if (Test-Path $gradlew) {
      Push-Location $existingAndroid
      try {
        $ErrorActionPreference = 'Continue'
        & .\gradlew.bat --stop 2>$null | Out-Null
      } finally {
        $ErrorActionPreference = 'Stop'
        Pop-Location
      }
    }

    # 잠금이 풀릴 때까지 몇 번 다시 시도한다.
    for ($attempt = 1; $attempt -le 5; $attempt += 1) {
      Remove-Item $existingAndroid -Recurse -Force -ErrorAction SilentlyContinue
      if (-not (Test-Path $existingAndroid)) { break }
      if ($attempt -eq 3) {
        # 그래도 남아 있으면 붙잡고 있는 Java 프로세스를 정리한다.
        Get-Process java -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
      }
      Start-Sleep -Seconds 2
    }
    if (Test-Path $existingAndroid) { throw '이전 android 폴더를 지우지 못했습니다.' }
  }

  Write-Host '네이티브 프로젝트를 생성합니다...' -ForegroundColor Cyan
  Invoke-Native { npx expo prebuild --platform android --clean } 'prebuild'

  $env:JAVA_HOME = Find-Jdk17
  Write-Host "JDK: $env:JAVA_HOME" -ForegroundColor DarkGray

  Push-Location (Join-Path $buildRoot 'android')
  try {
    Write-Host "$Variant APK를 빌드합니다..." -ForegroundColor Cyan
    Invoke-Native { & .\gradlew.bat "app:assemble$Variant" -x lint -x test } 'Gradle 빌드'
  } finally {
    Pop-Location
  }

  $apk = Join-Path $buildRoot "android\app\build\outputs\apk\$($Variant.ToLower())\app-$($Variant.ToLower()).apk"
  if (-not (Test-Path $apk)) { throw "APK를 찾지 못했습니다: $apk" }

  $sizeMb = [math]::Round((Get-Item $apk).Length / 1MB, 1)
  Write-Host "빌드 완료: $apk ($sizeMb MB)" -ForegroundColor Green

  if ($Install) {
    $adb = Find-Adb
    Write-Host '기기에 설치합니다...' -ForegroundColor Cyan
    Invoke-Native { & $adb install -r $apk } '설치'
    Write-Host '설치 완료' -ForegroundColor Green
  }
} finally {
  Pop-Location
}

# 复用 Wrangler 登录凭据调用 Cloudflare API，不在输出中展示令牌。
param([string]$Path, [string]$Method = 'GET', [string]$BodyFile)
$ErrorActionPreference = 'Stop'
$configPath = Join-Path $env:APPDATA 'xdg.config/.wrangler/config/default.toml'
$configText = Get-Content -LiteralPath $configPath -Raw
if ($configText -notmatch 'oauth_token\s*=\s*"([^"]+)"') { throw '缺少 Cloudflare 登录凭据' }
$requestHeaders = @{ Authorization = "Bearer $($matches[1])" }
$arguments = @{ Uri = "https://api.cloudflare.com/client/v4/$Path"; Method = $Method; Headers = $requestHeaders }
if ($BodyFile) { $arguments.Body = [System.IO.File]::ReadAllText((Resolve-Path $BodyFile)); $arguments.ContentType = 'application/json' }
$response = Invoke-RestMethod @arguments
if (!$response.success) { throw ($response.errors | ConvertTo-Json -Depth 5) }
$response.result | ConvertTo-Json -Depth 15

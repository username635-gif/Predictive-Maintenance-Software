$ErrorActionPreference = 'Stop'
$login = Invoke-RestMethod -Uri 'http://localhost:8080/api/v1/auth/login' -Method Post -ContentType 'application/json' -Body (@{
  email = 'you@example.com'
  password = 'DevTest123!'
} | ConvertTo-Json -Compress)
Write-Host 'LOGIN:'
$login | ConvertTo-Json -Depth 10
$token = $login.token
Write-Host "TOKEN_PREFIX=$($token.Substring(0,20))..."
$payload = '{"name":"API Probe Gateway","protocol":"MQTT","source_type":"real","segment_assignment":"SEG-001","status":"online"}'
$createRes = Invoke-WebRequest -Uri 'http://localhost:8080/api/v1/gateways' -Method Post -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } -Body $payload
Write-Host "POST_STATUS=$($createRes.StatusCode)"
Write-Host $createRes.Content
$createBody = $createRes.Content | ConvertFrom-Json
$id = $createBody.gateway.id
Write-Host "CREATED_ID=$id"
$list1 = Invoke-WebRequest -Uri 'http://localhost:8080/api/v1/gateways' -Method Get -Headers @{ Authorization = "Bearer $token" }
Write-Host "GET_LIST_STATUS=$($list1.StatusCode)"
Write-Host $list1.Content
$get1 = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/gateways/$id" -Method Get -Headers @{ Authorization = "Bearer $token" }
Write-Host "GET_ONE_STATUS=$($get1.StatusCode)"
Write-Host $get1.Content
$updatePayload = '{"name":"API Probe Gateway","protocol":"MQTT","source_type":"real","segment_assignment":"SEG-001","status":"degraded"}'
$putRes = Invoke-WebRequest -Uri "http://localhost:8080/api/v1/gateways/$id" -Method Put -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } -Body $updatePayload
Write-Host "PUT_STATUS=$($putRes.StatusCode)"
Write-Host $putRes.Content
$list2 = Invoke-WebRequest -Uri 'http://localhost:8080/api/v1/gateways' -Method Get -Headers @{ Authorization = "Bearer $token" }
Write-Host "GET_LIST_FINAL_STATUS=$($list2.StatusCode)"
Write-Host $list2.Content

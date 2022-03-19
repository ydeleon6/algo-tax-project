Write-Host "Destroying databases."
docker-compose down
Write-Host "Re-creating database."
docker-compose up -d
Write-Host "Loading it with known apps and assets"
npm run load-db
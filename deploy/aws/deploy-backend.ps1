# Backend Deployment Script for AWS (PowerShell)
# Prerequisites: AWS CLI installed and configured

param(
    [string]$Region = "us-east-1",
    [string]$VpcId,
    [string]$SubnetIds
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting Backend Deployment to AWS" -ForegroundColor Green

# Get AWS Account ID
$AccountId = aws sts get-caller-identity --query Account --output text
Write-Host "Account: $AccountId" -ForegroundColor Cyan
Write-Host "Region: $Region" -ForegroundColor Cyan

# Step 1: Create ECR Repository
Write-Host "📦 Creating ECR repository..." -ForegroundColor Yellow
aws cloudformation deploy `
    --template-file backend-ecr.yml `
    --stack-name rag-voice-agent-backend-ecr `
    --region $Region `
    --no-fail-on-empty-changeset

# Step 2: Login to ECR
Write-Host "🔐 Logging into ECR..." -ForegroundColor Yellow
$Password = aws ecr get-login-password --region $Region
docker login --username AWS --password-stdin "$AccountId.dkr.ecr.$Region.amazonaws.com"

# Step 3: Build and push Docker image
Write-Host "🏗️ Building backend Docker image..." -ForegroundColor Yellow
Set-Location ../../backend
docker build -t rag-voice-agent-backend .

Write-Host "📤 Tagging and pushing to ECR..." -ForegroundColor Yellow
docker tag rag-voice-agent-backend:latest "$AccountId.dkr.ecr.$Region.amazonaws.com/rag-voice-agent-backend:latest"
docker push "$AccountId.dkr.ecr.$Region.amazonaws.com/rag-voice-agent-backend:latest"

# Step 4: Create ECS infrastructure
Write-Host "⚙️ Creating ECS infrastructure..." -ForegroundColor Yellow
Set-Location ../deploy/aws

if (-not $VpcId -or -not $SubnetIds) {
    Write-Host "⚠️  Please provide VPC configuration:" -ForegroundColor Red
    $VpcId = Read-Host "Enter VPC ID"
    $SubnetIds = Read-Host "Enter Subnet IDs (comma-separated)"
}

aws cloudformation deploy `
    --template-file backend-service.yml `
    --stack-name rag-voice-agent-backend-service `
    --region $Region `
    --parameter-overrides `
        VpcId=$VpcId `
        SubnetIds=$SubnetIds `
    --capabilities CAPABILITY_IAM

# Step 5: Register Task Definition
Write-Host "📋 Registering ECS task definition..." -ForegroundColor Yellow
(Get-Content backend-task.json) -replace 'ACCOUNT_ID', $AccountId -replace 'REGION', $Region | Set-Content backend-task-updated.json
Move-Item backend-task.json backend-task-backup.json -Force
Move-Item backend-task-updated.json backend-task.json -Force

aws ecs register-task-definition --cli-input-json file://backend-task.json

# Step 6: Create ECS Service
Write-Host "🎯 Creating ECS service..." -ForegroundColor Yellow
$TargetGroupArn = aws cloudformation describe-stacks `
    --stack-name rag-voice-agent-backend-service `
    --region $Region `
    --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroup`].OutputValue' `
    --output text

$SubnetArray = $SubnetIds -split ',' | ForEach-Object { $_.Trim() }
$SubnetJson = $SubnetArray | ForEach-Object { "`"$_`"" } | Join-String -Separator ','
$SubnetJson = "[$SubnetJson]"

aws ecs create-service `
    --cluster rag-voice-agent-cluster `
    --service-name rag-voice-agent-backend `
    --task-definition rag-voice-agent-backend `
    --desired-count 1 `
    --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=$SubnetJson,securityGroups=[],assignPublicIp=ENABLED}" `
    --load-balancers "targetGroupArn=$TargetGroupArn,containerName=backend,containerPort=8000"

# Step 7: Wait for service to be stable
Write-Host "⏳ Waiting for service to stabilize..." -ForegroundColor Yellow
aws ecs wait services-stable `
    --cluster rag-voice-agent-cluster `
    --services rag-voice-agent-backend `
    --region $Region

# Get Load Balancer URL
$LoadBalancerUrl = aws cloudformation describe-stacks `
    --stack-name rag-voice-agent-backend-service `
    --region $Region `
    --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' `
    --output text

Write-Host "✅ Backend deployment complete!" -ForegroundColor Green
Write-Host "🌐 Your backend is available at: http://$LoadBalancerUrl" -ForegroundColor Cyan
Write-Host "🔍 Health check: http://$LoadBalancerUrl/health" -ForegroundColor Cyan

# Cleanup
Move-Item backend-task-backup.json backend-task.json -Force -ErrorAction SilentlyContinue

Write-Host "🎉 Done!" -ForegroundColor Green

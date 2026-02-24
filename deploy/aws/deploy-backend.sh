#!/bin/bash

# Backend Deployment Script for AWS
# Prerequisites: AWS CLI installed and configured

set -e

# Configuration
REGION="us-east-1"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPOSITORY="rag-voice-agent-backend"
ECS_CLUSTER="rag-voice-agent-cluster"
ECS_SERVICE="rag-voice-agent-backend"

echo "🚀 Starting Backend Deployment to AWS"
echo "Account: $ACCOUNT_ID"
echo "Region: $REGION"

# Step 1: Create ECR Repository
echo "📦 Creating ECR repository..."
aws cloudformation deploy \
  --template-file backend-ecr.yml \
  --stack-name rag-voice-agent-backend-ecr \
  --region $REGION \
  --no-fail-on-empty-changeset

# Step 2: Login to ECR
echo "🔐 Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Step 3: Build and push Docker image
echo "🏗️ Building backend Docker image..."
cd ../../backend
docker build -t $ECR_REPOSITORY .

echo "📤 Tagging and pushing to ECR..."
docker tag $ECR_REPOSITORY:latest $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY:latest
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPOSITORY:latest

# Step 4: Create ECS infrastructure
echo "⚙️ Creating ECS infrastructure..."
cd ../deploy/aws

# You need to provide VPC ID and Subnet IDs
echo "⚠️  Please provide your VPC configuration:"
read -p "Enter VPC ID: " VPC_ID
read -p "Enter Subnet IDs (comma-separated): " SUBNET_IDS

aws cloudformation deploy \
  --template-file backend-service.yml \
  --stack-name rag-voice-agent-backend-service \
  --region $REGION \
  --parameter-overrides \
    VpcId=$VPC_ID \
    SubnetIds=$SUBNET_IDS \
  --capabilities CAPABILITY_IAM

# Step 5: Register Task Definition
echo "📋 Registering ECS task definition..."
sed -i.bak "s/ACCOUNT_ID/$ACCOUNT_ID/g" backend-task.json
sed -i.bak "s/REGION/$REGION/g" backend-task.json

aws ecs register-task-definition --cli-input-json file://backend-task.json

# Step 6: Create ECS Service
echo "🎯 Creating ECS service..."
TARGET_GROUP_ARN=$(aws cloudformation describe-stacks \
  --stack-name rag-voice-agent-backend-service \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`BackendTargetGroup`].OutputValue' \
  --output text)

aws ecs create-service \
  --cluster $ECS_CLUSTER \
  --service-name $ECS_SERVICE \
  --task-definition rag-voice-agent-backend \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_IDS],securityGroups=[],assignPublicIp=ENABLED}" \
  --load-balancers targetGroupArn=$TARGET_GROUP_ARN,containerName=backend,containerPort=8000

# Step 7: Wait for service to be stable
echo "⏳ Waiting for service to stabilize..."
aws ecs wait services-stable \
  --cluster $ECS_CLUSTER \
  --services $ECS_SERVICE \
  --region $REGION

# Get Load Balancer URL
LOAD_BALANCER_URL=$(aws cloudformation describe-stacks \
  --stack-name rag-voice-agent-backend-service \
  --region $REGION \
  --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
  --output text)

echo "✅ Backend deployment complete!"
echo "🌐 Your backend is available at: http://$LOAD_BALANCER_URL"
echo "🔍 Health check: http://$LOAD_BALANCER_URL/health"

# Cleanup
mv backend-task.json.bak backend-task.json

echo "🎉 Done!"

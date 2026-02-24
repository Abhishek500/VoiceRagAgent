# AWS Deployment Guide - Backend Only

## Prerequisites

1. **Install AWS CLI**
   ```bash
   # Windows
   # Download and install from: https://aws.amazon.com/cli/
   
   # After installation, verify:
   aws --version
   ```

2. **Configure AWS Credentials**
   ```bash
   aws configure
   # Enter your AWS Access Key ID
   # Enter your Secret Access Key
   # Enter default region (us-east-1)
   # Enter default output format (json)
   ```

3. **Install Docker** (already installed if running locally)

## Quick Start

### Option 1: PowerShell (Windows)
```powershell
cd deploy\aws
.\deploy-backend.ps1
```

### Option 2: Bash (Linux/Mac/WSL)
```bash
cd deploy/aws
chmod +x deploy-backend.sh
./deploy-backend.sh
```

## Manual Steps

If the script fails, you can run these steps manually:

### 1. Create ECR Repository
```bash
aws cloudformation deploy \
  --template-file backend-ecr.yml \
  --stack-name rag-voice-agent-backend-ecr \
  --region us-east-1
```

### 2. Build and Push Image
```bash
# Login to ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

# Build and push
cd ../../backend
docker build -t rag-voice-agent-backend .
docker tag rag-voice-agent-backend:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/rag-voice-agent-backend:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/rag-voice-agent-backend:latest
```

### 3. Deploy to ECS
```bash
# Get your VPC ID and Subnet IDs from AWS Console
aws cloudformation deploy \
  --template-file backend-service.yml \
  --stack-name rag-voice-agent-backend-service \
  --region us-east-1 \
  --parameter-overrides \
    VpcId=vpc-xxxxxxxxx \
    SubnetIds=subnet-xxxxx,subnet-yyyyy \
  --capabilities CAPABILITY_IAM
```

## Required Environment Variables

Before deploying, create these secrets in AWS Secrets Manager:

```bash
# Create secrets (replace with your actual values)
aws secretsmanager create-secret --name rag-voice-agent/mongo-url --secret-string "mongodb+srv://username:password@cluster.mongodb.net/?retryWrites=true&w=majority"
aws secretsmanager create-secret --name rag-voice-agent/groq-api-key --secret-string "gsk_xxxxxxxxxxxx"
aws secretsmanager create-secret --name rag-voice-agent/deepgram-api-key --secret-string "xxxxxxxxxxxx"
aws secretsmanager create-secret --name rag-voice-agent/elevenlabs-api-key --secret-string "xxxxxxxxxxxx"
aws secretsmanager create-secret --name rag-voice-agent/google-api-key --secret-string "xxxxxxxxxxxx"
```

## Verify Deployment

After deployment:

1. **Check Load Balancer URL**
   ```bash
   aws cloudformation describe-stacks \
     --stack-name rag-voice-agent-backend-service \
     --query 'Stacks[0].Outputs[?OutputKey==`LoadBalancerDNS`].OutputValue' \
     --output text
   ```

2. **Test Health Endpoint**
   ```bash
   curl http://<load-balancer-url>/health
   ```

3. **Check ECS Service Status**
   ```bash
   aws ecs describe-services \
     --cluster rag-voice-agent-cluster \
     --services rag-voice-agent-backend
   ```

## Troubleshooting

### Common Issues

1. **"aws command not found"**
   - Install AWS CLI: https://aws.amazon.com/cli/

2. **"Unable to locate credentials"**
   - Run `aws configure` and set up credentials

3. **"Task failed to start"**
   - Check CloudWatch logs: `/ecs/rag-voice-agent-backend`
   - Verify secrets are correctly configured

4. **"Load balancer health checks failing"**
   - Ensure backend container port 8000 is accessible
   - Check security group configuration

### Monitoring

- **CloudWatch Logs**: `/ecs/rag-voice-agent-backend`
- **ECS Service Metrics**: AWS Console → ECS → rag-voice-agent-cluster
- **Load Balancer Metrics**: AWS Console → EC2 → Load Balancers

## Cost Monitoring

Free tier limits to watch:
- ECS Fargate: 400,000 vCPU-seconds/month
- ECR Storage: 500 MB
- Data Transfer: 100 GB/month
- CloudWatch Logs: 10 GB

Check your usage: `aws ce get-cost-and-usage --time-period Start=2024-01-01,End=2024-01-31 --granularity MONTHLY --metrics BlendedCost`

## Next Steps

After backend is deployed:
1. Test all API endpoints
2. Set up monitoring and alerts
3. Deploy frontend (frontend-deployment.md)
4. Configure custom domain and SSL

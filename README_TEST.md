# Test Environment Setup

## Ports
- Backend: http://localhost:8001
- Frontend: http://localhost:3001
- API Docs: http://localhost:8001/docs

## Running Test Version
```bash
cd rag_voice_ai_agent-test
docker-compose up --build -d
```

## Stopping Test Version
```bash
cd rag_voice_ai_agent-test
docker-compose down
```

## Accessing Test Environment
- Frontend: http://localhost:3001
- Backend API: http://localhost:8001/api/v1
- Swagger Docs: http://localhost:8001/docs

## Database Isolation (Optional)
To use separate test database, update backend/.env:
```
DB_NAME=rag_voice_agent_test_db
```

## Docker Extensions Needed
Install these VS Code extensions:
1. Docker (Microsoft)
2. Docker Explorer (Microsoft)
3. Remote - SSH (Microsoft)

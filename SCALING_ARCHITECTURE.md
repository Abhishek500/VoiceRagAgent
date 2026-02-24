# 📈 Scaling Architecture for Thousands of Users

## Current Architecture Analysis

The current backend uses:
- **FastAPI** with WebSocket connections for real-time voice AI
- **MongoDB Atlas** for document storage and vector search
- **RAG (Retrieval-Augmented Generation)** for knowledge base queries
- **Pipecat** for voice processing pipeline

## 🏗️ Recommended Scaling Architecture

### 1. **Database Scaling**

#### MongoDB Atlas Scaling
```yaml
# MongoDB Atlas Configuration
Cluster Tier: M30+ (for production)
- Sharding enabled for horizontal scaling
- Auto-scaling based on CPU/memory usage
- Multi-region replication for HA

Collections:
- equipment: Sharded by tenant_id
- document_chunks: Sharded by equipment_id + tenant_id
- documents_metadata: Sharded by equipment_id
- user_sessions: Sharded by user_id
```

#### Connection Pooling
```python
# Enhanced database.py
client = AsyncIOMotorClient(
    settings.MONGO_URL,
    maxPoolSize=100,  # Increase connection pool
    minPoolSize=10,
    maxIdleTimeMS=30000,
    serverSelectionTimeoutMS=5000,
    connectTimeoutMS=10000,
    retryWrites=True,
    w="majority"
)
```

### 2. **Application Layer Scaling**

#### Load Balancer + Multiple Instances
```
Internet → ALB/NGINX → Multiple FastAPI Instances
                              ↓
                         Shared MongoDB Atlas
                         Shared Redis Cache
```

#### Container Orchestration
```yaml
# docker-compose.production.yml
version: '3.8'
services:
  api:
    image: voice-ai-backend:latest
    replicas: 5-20  # Auto-scaling
    resources:
      limits:
        cpus: '1'
        memory: 2G
    environment:
      - REDIS_URL=redis://redis-cluster:6379
      - MONGO_URL=${MONGO_URL}
    
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
      - "80:80"
    config: ./nginx.conf
    
  redis:
    image: redis:alpine
    command: redis-server --cluster-enabled yes
```

### 3. **Caching Strategy**

#### Redis Multi-Layer Caching
```python
# cache_service.py
class CacheService:
    def __init__(self):
        self.redis = Redis.from_url(settings.REDIS_URL)
        
    # L1: Embedding cache (24h TTL)
    async def get_embedding(self, text_hash: str):
        return await self.redis.get(f"emb:{text_hash}")
    
    # L2: RAG results cache (1h TTL) 
    async def get_rag_result(self, query_hash: str):
        return await self.redis.get(f"rag:{query_hash}")
    
    # L3: Equipment metadata cache (6h TTL)
    async def get_equipment(self, equipment_id: str):
        return await self.redis.get(f"eq:{equipment_id}")
```

### 4. **WebSocket Connection Management**

#### Connection Pooling & State Management
```python
# connection_manager.py
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_sessions: Dict[str, Set[str]] = {}  # user_id -> connection_ids
        
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        connection_id = str(uuid.uuid4())
        self.active_connections[connection_id] = websocket
        
        if user_id not in self.user_sessions:
            self.user_sessions[user_id] = set()
        self.user_sessions[user_id].add(connection_id)
        
        return connection_id
    
    async def disconnect(self, connection_id: str, user_id: str):
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if user_id in self.user_sessions:
            self.user_sessions[user_id].discard(connection_id)
```

#### Rate Limiting
```python
# rate_limiter.py
class RateLimiter:
    def __init__(self, redis: Redis):
        self.redis = redis
        
    async def is_allowed(self, user_id: str, limit: int = 100, window: int = 60):
        key = f"rate_limit:{user_id}"
        current = await self.redis.incr(key)
        
        if current == 1:
            await self.redis.expire(key, window)
            
        return current <= limit
```

### 5. **RAG Service Optimization**

#### Vector Search Optimization
```python
# Enhanced rag.py
class RAGService:
    def __init__(self):
        self.cache_service = CacheService()
        
    async def retrieve(self, query: str, equipment_id: str, tenant_id: str):
        # Check cache first
        query_hash = hashlib.md5(query.encode()).hexdigest()
        cached_result = await self.cache_service.get_rag_result(query_hash)
        if cached_result:
            return json.loads(cached_result)
            
        # Implement semantic caching
        # Batch embedding generation
        # Use approximate nearest neighbor search
```

#### Embedding Service Scaling
```python
# embeddings.py
class EmbeddingService:
    def __init__(self):
        self.batch_size = 32
        self.cache = CacheService()
        
    async def embed_batch(self, texts: List[str]) -> List[List[float]]:
        # Batch processing for efficiency
        # Cache individual embeddings
        # Use connection pooling for embedding API
```

### 6. **Microservices Architecture**

#### Service Decomposition
```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   API Gateway   │  │  Voice Service  │  │   RAG Service   │
│   (FastAPI)     │  │   (Pipecat)     │  │   (FastAPI)     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌─────────────────┐
                    │  Shared Cache   │
                    │    (Redis)     │
                    └─────────────────┘
```

#### Service Communication
```python
# message_queue.py
class MessageQueue:
    def __init__(self):
        self.redis = Redis.from_url(settings.REDIS_URL)
        
    async def publish_rag_request(self, request: RAGRequest):
        await self.redis.lpush("rag_queue", request.json())
        
    async def consume_rag_requests(self):
        while True:
            request = await self.redis.brpop("rag_queue", timeout=1)
            if request:
                await self.process_rag_request(request[1])
```

### 7. **Monitoring & Observability**

#### Metrics Collection
```python
# monitoring.py
from prometheus_client import Counter, Histogram, Gauge

# Business metrics
active_connections = Gauge('active_connections', 'Active WebSocket connections')
rag_requests = Counter('rag_requests_total', 'Total RAG requests')
rag_latency = Histogram('rag_request_duration_seconds', 'RAG request latency')

# System metrics
cpu_usage = Gauge('cpu_usage_percent', 'CPU usage percentage')
memory_usage = Gauge('memory_usage_bytes', 'Memory usage in bytes')
```

#### Health Checks
```python
# health.py
@router.get("/health/detailed")
async def detailed_health():
    checks = {
        "database": await check_database(),
        "redis": await check_redis(),
        "embedding_service": await check_embedding_service(),
        "active_connections": len(connection_manager.active_connections)
    }
    return {"status": "healthy", "checks": checks}
```

### 8. **Security & Authentication**

#### JWT Token Management
```python
# auth.py
class AuthService:
    def __init__(self):
        self.redis = Redis.from_url(settings.REDIS_URL)
        
    async def create_token(self, user_id: str, permissions: List[str]):
        token = jwt.encode({
            "user_id": user_id,
            "permissions": permissions,
            "exp": datetime.utcnow() + timedelta(hours=24)
        }, settings.SECRET_KEY)
        
        await self.redis.setex(f"token:{user_id}", 86400, token)
        return token
        
    async def validate_token(self, token: str):
        cached = await self.redis.get(f"token_cache:{token}")
        if cached:
            return json.loads(cached)
            
        # Validate JWT and cache result
```

### 9. **Deployment Strategy**

#### Kubernetes Configuration
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voice-ai-backend
spec:
  replicas: 10
  selector:
    matchLabels:
      app: voice-ai-backend
  template:
    metadata:
      labels:
        app: voice-ai-backend
    spec:
      containers:
      - name: api
        image: voice-ai-backend:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        env:
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: redis-url
```

#### Auto-scaling Policy
```yaml
# k8s/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: voice-ai-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: voice-ai-backend
  minReplicas: 5
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

## 📊 Performance Targets

| Metric | Target | Current | Notes |
|--------|--------|---------|-------|
| Concurrent WebSocket Connections | 10,000+ | ~100 | Need connection pooling |
| RAG Query Latency | <500ms | ~2s | Add caching & optimization |
| Voice Response Time | <1s | ~3s | Optimize pipeline |
| Database Query Time | <100ms | ~500ms | Add indexes & caching |
| System Uptime | 99.9% | 99% | Add monitoring |

## 🚀 Implementation Priority

1. **Phase 1 (Immediate)**: Add Redis caching, connection pooling
2. **Phase 2 (1-2 weeks)**: Implement rate limiting, monitoring
3. **Phase 3 (1 month)**: Microservices decomposition, K8s deployment
4. **Phase 4 (2 months)**: Advanced auto-scaling, performance optimization

## 💰 Cost Considerations

- **MongoDB Atlas**: M30 cluster ~$2,000/month
- **Redis Cluster**: $500/month for high availability
- **Kubernetes**: $1,000/month for managed service
- **Monitoring**: $200/month for observability tools
- **Total Estimated**: $3,700/month for 10K users

This architecture provides horizontal scalability, high availability, and can handle thousands of concurrent users with proper resource allocation.

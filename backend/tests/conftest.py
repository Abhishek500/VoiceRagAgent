"""Pytest configuration and fixtures."""
import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient
from motor.motor_asyncio import AsyncIOMotorClient

from main import app
from app.config import settings


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def test_db():
    """Create a test database connection."""
    client = AsyncIOMotorClient(settings.MONGO_URL)
    db = client[f"{settings.DB_NAME}_test"]
    
    yield db
    
    # Cleanup
    await client.drop_database(f"{settings.DB_NAME}_test")
    client.close()


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    """Create an async HTTP client for testing."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_equipment_data():
    """Sample equipment data for testing."""
    return {
        "name": "Test Equipment",
        "description": "Test Description",
        "tenant_id": "test_tenant",
        "is_active": True
    }


@pytest.fixture
def sample_chunk_data():
    """Sample chunk data for testing."""
    return {
        "text": "This is a test chunk of text for RAG testing.",
        "embedding": [0.1] * 768,  # Mock embedding vector
        "chunk_index": 0,
        "file_name": "test.pdf"
    }

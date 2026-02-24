"""Unit tests for RAG service."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from bson import ObjectId

from app.services.rag import RAGService


@pytest.mark.asyncio
async def test_rag_retrieve_with_equipment_filter(test_db, sample_chunk_data):
    """Test RAG retrieval with equipment_id filter."""
    # Mock the database collection
    mock_collection = AsyncMock()
    mock_cursor = AsyncMock()
    mock_cursor.to_list = AsyncMock(return_value=[
        {
            "_id": ObjectId(),
            "chunk_id": "test-chunk-1",
            "document_id": ObjectId(),
            "equipment_id": ObjectId(),
            "tenant_id": "test_tenant",
            "text": "Test chunk content",
            "chunk_index": 0,
            "file_name": "test.pdf",
            "score": 0.85
        }
    ])
    mock_collection.aggregate = AsyncMock(return_value=mock_cursor)
    
    with patch('app.services.rag.get_database') as mock_get_db:
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        mock_get_db.return_value = mock_db
        
        with patch('app.services.rag.embeddings_service.embed_text') as mock_embed:
            mock_embed.return_value = [0.1] * 768
            
            rag_service = RAGService()
            result = await rag_service.retrieve(
                query="test query",
                k=5,
                equipment_id=str(ObjectId()),
                tenant_id="test_tenant"
            )
            
            assert result.metadata.chunks_retrieved == 1
            assert len(result.data) == 1
            assert result.data[0].text == "Test chunk content"


@pytest.mark.asyncio
async def test_rag_retrieve_over_fetching():
    """Test that RAG over-fetches candidates before filtering."""
    with patch('app.services.rag.get_database') as mock_get_db:
        mock_collection = AsyncMock()
        mock_cursor = AsyncMock()
        mock_cursor.to_list = AsyncMock(return_value=[])
        mock_collection.aggregate = AsyncMock(return_value=mock_cursor)
        
        mock_db = MagicMock()
        mock_db.__getitem__ = MagicMock(return_value=mock_collection)
        mock_get_db.return_value = mock_db
        
        with patch('app.services.rag.embeddings_service.embed_text') as mock_embed:
            mock_embed.return_value = [0.1] * 768
            
            rag_service = RAGService()
            await rag_service.retrieve(query="test", k=5)
            
            # Verify that aggregate was called
            call_args = mock_collection.aggregate.call_args[0][0]
            search_stage = call_args[0]
            
            # Should over-fetch (k * 20 = 100 minimum)
            assert search_stage["$search"]["knnBeta"]["k"] >= 100

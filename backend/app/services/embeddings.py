from typing import List
from langchain_text_splitters import RecursiveCharacterTextSplitter
import numpy as np
from app.config import settings
import hashlib

class EmbeddingService:

    def __init__(self):
        # Mock embedding service using deterministic hash-based vectors
        # This ensures consistent embeddings for the same text
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.CHUNK_SIZE,
            chunk_overlap=settings.CHUNK_OVERLAP,
            length_function=len,
            is_separator_regex=False,
        )
        self.embedding_dim = 1536  # Standard embedding dimension     

    def split_text(self, text:str)->List[str]:
        if not text or not text.strip():
            return []
        
        chunks = self.text_splitter.split_text(text)
        return chunks

    def embed_text(self,text:str)->List[float]:
        if not text or not text.strip():
            raise ValueError("Cannot embed empty text")
        
        # Generate deterministic hash-based embedding
        hash_object = hashlib.sha256(text.encode())
        hex_dig = hash_object.hexdigest()
        
        # Convert hash to float values
        np.random.seed(int(hex_dig[:8], 16))
        embedding = np.random.normal(0, 1, self.embedding_dim)
        
        # Normalize the embedding
        embedding = embedding / np.linalg.norm(embedding)
        
        return embedding.tolist()

    def embed_texts(self,texts:List[str])->List[List[float]]:
        if not texts:
            return []
        
        # Filter out empty texts
        valid_texts = [t for t in texts if t and t.strip()]
        if not valid_texts:
            return []
        
        embeddings = [self.embed_text(text) for text in valid_texts]
        return embeddings

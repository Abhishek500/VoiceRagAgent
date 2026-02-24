"""
Examples of how to use different prompts in the voice AI agent.

This file demonstrates how to specify different prompt types when connecting to the bot.
"""

# Example WebSocket connection body parameters for different use cases:

# 1. Default call center agent (default behavior)
CALL_CENTER_EXAMPLE = {
    "equipment_id": "12345",
    "tenant_id": "tenant_001",
    "session_id": "session_abc123",
    "user_id": "user_456",
    # prompt_type is optional, defaults to "call_center"
}

# 2. Technical support agent
TECHNICAL_SUPPORT_EXAMPLE = {
    "equipment_id": "12345",
    "tenant_id": "tenant_001", 
    "session_id": "session_def456",
    "user_id": "user_789",
    "prompt_type": "technical"  # Uses technical support prompt
}

# 3. Customer service agent
CUSTOMER_SERVICE_EXAMPLE = {
    "equipment_id": "12345",
    "tenant_id": "tenant_001",
    "session_id": "session_ghi789", 
    "user_id": "user_012",
    "prompt_type": "customer_service"  # Uses customer service prompt
}

# 4. Sales support agent
SALES_SUPPORT_EXAMPLE = {
    "equipment_id": "12345",
    "tenant_id": "tenant_001",
    "session_id": "session_jkl012",
    "user_id": "user_345", 
    "prompt_type": "sales"  # Uses sales support prompt
}

# 5. Emergency response agent
EMERGENCY_RESPONSE_EXAMPLE = {
    "equipment_id": "12345",
    "tenant_id": "tenant_001",
    "session_id": "session_mno345",
    "user_id": "user_678",
    "prompt_type": "emergency"  # Uses emergency response prompt
}

# 6. Document Q&A agent
DOCUMENT_QNA_EXAMPLE = {
    "equipment_id": "12345",
    "tenant_id": "tenant_001",
    "session_id": "session_pqr678",
    "user_id": "user_901",
    "prompt_type": "document_qna"  # Uses document Q&A prompt
}

# Available prompt types:
AVAILABLE_PROMPT_TYPES = [
    "call_center",      # Default call center agent
    "technical",        # Technical support specialist  
    "customer_service", # Customer service representative
    "sales",           # Sales support assistant
    "emergency",       # Emergency response operator
    "document_qna",     # Document Q&A specialist
]

def get_example_for_prompt_type(prompt_type: str) -> dict:
    """Get an example connection body for a specific prompt type."""
    examples = {
        "call_center": CALL_CENTER_EXAMPLE,
        "technical": TECHNICAL_SUPPORT_EXAMPLE,
        "customer_service": CUSTOMER_SERVICE_EXAMPLE,
        "sales": SALES_SUPPORT_EXAMPLE,
        "emergency": EMERGENCY_RESPONSE_EXAMPLE,
        "document_qna": DOCUMENT_QNA_EXAMPLE,
    }
    return examples.get(prompt_type, CALL_CENTER_EXAMPLE)

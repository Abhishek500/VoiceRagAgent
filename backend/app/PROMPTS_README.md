# Voice AI Agent Prompts System

This document explains how to use the modular prompt system in the voice AI agent.

## Overview

The voice AI agent now supports multiple prompt types for different use cases. Instead of hardcoded prompts, the system uses a modular `prompts.py` file that contains specialized prompts for various scenarios.

## Available Prompt Types

1. **`call_center`** (default) - Standard call center agent support
2. **`technical`** - Technical support and troubleshooting
3. **`customer_service`** - Customer service and support
4. **`sales`** - Sales support and assistance
5. **`emergency`** - Emergency response situations
6. **`document_qna`** - Document-based question answering

## How to Use Different Prompts

When connecting to the bot via WebSocket, include the `prompt_type` parameter in your connection body:

```json
{
  "equipment_id": "12345",
  "tenant_id": "tenant_001", 
  "session_id": "session_abc123",
  "user_id": "user_456",
  "prompt_type": "technical"
}
```

### Example Usage

#### Technical Support Agent
```json
{
  "equipment_id": "tech_equipment_001",
  "tenant_id": "tech_tenant",
  "session_id": "tech_session_001",
  "user_id": "tech_user_001",
  "prompt_type": "technical"
}
```

#### Customer Service Agent
```json
{
  "equipment_id": "cs_equipment_001", 
  "tenant_id": "cs_tenant",
  "session_id": "cs_session_001",
  "user_id": "cs_user_001",
  "prompt_type": "customer_service"
}
```

#### Sales Support Agent
```json
{
  "equipment_id": "sales_equipment_001",
  "tenant_id": "sales_tenant", 
  "session_id": "sales_session_001",
  "user_id": "sales_user_001",
  "prompt_type": "sales"
}
```

#### Emergency Response Agent
```json
{
  "equipment_id": "emergency_equipment_001",
  "tenant_id": "emergency_tenant",
  "session_id": "emergency_session_001", 
  "user_id": "emergency_user_001",
  "prompt_type": "emergency"
}
```

#### Document Q&A Agent
```json
{
  "equipment_id": "doc_equipment_001",
  "tenant_id": "doc_tenant",
  "session_id": "doc_session_001",
  "user_id": "doc_user_001",
  "prompt_type": "document_qna"
}
```

## Default Behavior

If no `prompt_type` is specified, the system defaults to the `call_center` prompt.

## Adding New Prompts

To add a new prompt type:

1. Open `app/prompts.py`
2. Add your new prompt as a constant (e.g., `NEW_PROMPT_TYPE = """..."""`)
3. Add the new prompt to the `prompts` dictionary in the `get_prompt()` function
4. Update the available prompt types list in `prompts_usage_examples.py`

## Prompt Characteristics

Each prompt is optimized for:
- **Speech output** - Natural, conversational language
- **Conciseness** - Brief responses suitable for real-time interaction
- **Specialized behavior** - Tailored to specific use cases
- **Knowledge base integration** - Proper use of the RAG system

## Files Modified

- `app/bot.py` - Updated to import and use dynamic prompts
- `app/prompts.py` - New file containing all prompt definitions
- `app/prompts_usage_examples.py` - Examples and documentation
- `app/PROMPTS_README.md` - This documentation file

## Testing

The system has been tested with:
- ✅ Prompt module imports
- ✅ Dynamic prompt selection
- ✅ Docker container restart
- ✅ Backend startup with new prompt system

All containers are running successfully on:
- Frontend: http://localhost:3001
- Backend: http://localhost:8001

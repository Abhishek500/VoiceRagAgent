from typing import Dict, Any
import os
from dotenv import load_dotenv
from loguru import logger

from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.services.llm_service import FunctionCallParams
from pipecat.transcriptions.language import Language

print("🚀 Starting Pipecat bot...")
print("⏳ Loading models and imports (20 seconds, first run only)\n")

from pipecat.adapters.schemas.tools_schema import ToolsSchema
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
logger.info("✅ Local Smart Turn Analyzer V3 loaded")
logger.info("Loading Silero VAD model...")

from pipecat.audio.vad.silero import SileroVADAnalyzer

logger.info("✅ Silero VAD model loaded")

from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.frames.frames import Frame, LLMMessagesAppendFrame, LLMRunFrame, TranscriptionFrame

logger.info("Loading pipeline components...")

from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair

from pipecat.processors.frameworks.rtvi import RTVIConfig, RTVIObserver, RTVIProcessor
from pipecat.runner.types import RunnerArguments, WebSocketRunnerArguments
from pipecat.serializers.protobuf import ProtobufFrameSerializer
from pipecat.services.deepgram.stt import DeepgramSTTService
from pipecat.services.groq.llm import GroqLLMService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.transports.base_transport import BaseTransport
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport,
)

from pipecat.processors.frameworks.rtvi import RTVIServerMessageFrame
from deepgram import LiveOptions
from pipecat.adapters.schemas.function_schema import FunctionSchema
from app.services.rag import RAGService
from app.config import settings
from app.database import get_database
from app.prompts import get_prompt
from bson import ObjectId
from datetime import datetime

class TextCaptureProcessor(FrameProcessor):
    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, LLMMessagesAppendFrame):
            for message in frame.messages:
                if message.get("role") == "user":
                    await self.push_frame(
                        TranscriptionFrame(
                            text=message.get('content'),
                            user_id="agent",
                            timestamp=datetime.now().isoformat(),
                            language=Language.EN_IN
                        )
                    )
        await self.push_frame(frame, direction)


logger.info("✅ All components loaded successfully!")

load_dotenv(override=True)


async def run_bot(transport: BaseTransport, runner_args: RunnerArguments):
    logger.info(f"Starting bot")
    body: Dict[str, Any] = runner_args.body
    equipment_id: str = body.get("equipment_id", "")
    tenant_id: str = body.get("tenant_id", settings.TENANT_ID)
    session_id: str = body.get("session_id", "")
    user_id: str = body.get("user_id", settings.USER_ID)
    prompt_type: str = body.get("prompt_type", "call_center")  # Default to call_center prompt

    # If tenant_id isn't explicitly provided, infer it from the equipment.
    if equipment_id and "tenant_id" not in body:
        try:
            db = get_database()
            equipment = await db.equipment.find_one({"_id": ObjectId(equipment_id)})
            if equipment and equipment.get("tenant_id"):
                tenant_id = equipment["tenant_id"]
        except Exception as e:
            logger.warning(f"Failed to infer tenant_id from equipment_id={equipment_id}: {e}")

    live_options = LiveOptions(
        diarize=True
    )
    stt = DeepgramSTTService(
        api_key=os.getenv("DEEPGRAM_API_KEY"),
        live_options=live_options,
    )

    rtvi = RTVIProcessor(config=RTVIConfig(config=[]))

    async def search_knowledge_base(params: FunctionCallParams):
        try:
            query = params.arguments.get("query", "")
            rag_service = RAGService()
            retrieval_result = await rag_service.retrieve(
                query=query, 
                k=5, 
                equipment_id=equipment_id, 
                tenant_id=tenant_id
            )

            clean_data = [
                {
                    "id": meta.chunk_id,
                    "content": chunk.text,
                }
                for chunk, meta in zip(retrieval_result.data,
                                    retrieval_result.metadata.chunks)
            ]

            await params.result_callback({"results": clean_data})

            await rtvi.push_frame(
                RTVIServerMessageFrame(
                    data={
                        "type":"search_knowledge_base",
                        "chunks":[
                            {
                                "id": meta.chunk_id,
                                "text": chunk.text,
                                "metadata": meta.model_dump()
                            }
                            for chunk, meta in zip(
                                retrieval_result.data,
                                retrieval_result.metadata.chunks
                            )
                        ]
                    }
                )
            )

        except Exception as e:
            logger.error(f"Error in search_knowledge_base: {e}")
            await params.result_callback({"results": []})


    search_tool = FunctionSchema(
        name="search_knowledge_base",
        description="Search the knowledge base for relevant information",
        properties={"query": {"type": "string"}},
        required=["query"]
    )

    llm = GroqLLMService(
        api_key=os.getenv("GROQ_API_KEY"),
        model=settings.GROQ_MODEL,
        base_url=settings.GROQ_BASE_URL,
    )

    llm.register_function(
        "search_knowledge_base",
        search_knowledge_base,
        cancel_on_interruption=False
    )

    messages = [
        {
            "role": "system",
            "content": get_prompt(prompt_type),
        },
    ]

    context = LLMContext(messages, tools=ToolsSchema(standard_tools=[search_tool]))
    context_aggregator = LLMContextAggregatorPair(context)

    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVENLABS_API_KEY", ""),
        voice_id=os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpgDQGcFmaJgB"),
    )

    pipeline = Pipeline([
        transport.input(),
        rtvi,  # RTVI processor
        TextCaptureProcessor(),
        stt,
        context_aggregator.user(),  # User responses
        llm,  # LLM
        tts, # TTS
        transport.output(),  # Transport bot output
        context_aggregator.assistant(),  # Assistant spoken responses
    ])

    observers = [
        RTVIObserver(rtvi),
    ]

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            enable_metrics=True,
            enable_usage_metrics=True,
        ),
        observers=observers,
        cancel_on_idle_timeout=True,
        idle_timeout_secs=300,
    )


    @rtvi.event_handler("on_client_ready")
    async def on_client_ready(rtvi):
        await rtvi.set_bot_ready()

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        logger.info(f"Client connected")
        messages.append({"role": "system", "content": "Say hello and briefly introduce yourself."})
        await task.queue_frames([LLMRunFrame()])

    @transport.event_handler("on_client_disconnected")
    async def on_client_disconnected(transport, client):
        logger.info(f"Client disconnected")
        await task.cancel()

    runner = PipelineRunner(handle_sigint=runner_args.handle_sigint)



    try:
        await runner.run(task)
    except Exception as e:
        logger.error(f"Error in bot: {e}")
        raise e


async def bot(runner_args: WebSocketRunnerArguments):
    transport = FastAPIWebsocketTransport(
        websocket=runner_args.websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            add_wav_header=False,
            vad_analyzer=SileroVADAnalyzer(params=VADParams(stop_secs=0.2)),
            serializer=ProtobufFrameSerializer(),
            turn_analyzer=LocalSmartTurnAnalyzerV3(),
        ),
    )

    try:
        await run_bot(transport, runner_args)
    except Exception as e:
        logger.error(f"Error in bot: {e}")
        raise e

if __name__ == "__main__":
    from pipecat.runner.run import main
    main()

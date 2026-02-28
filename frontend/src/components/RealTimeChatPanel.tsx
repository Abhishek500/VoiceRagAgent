import { useState, useEffect, useRef } from "react";
import {
  usePipecatClient,
  usePipecatClientTransportState,
  useRTVIClientEvent,
  PipecatClientMicToggle,
  PipecatClientAudio,
} from "@pipecat-ai/client-react";
import { RTVIEvent, TransportStateEnum } from "@pipecat-ai/client-js";
import { Play, StopCircle, Mic, MicOff, Send, Bot, PauseCircle, RotateCcw } from "lucide-react";
import { ChatMessage } from "@/types/ChatMessage";
import { ChunkMetadata } from "@/types/Chunk";
import { getId } from "@/utils/chat";
import BotMessageBubble from "./BotMessageBubble";
import UserMessageBubble from "./UserMessageBubble";
import usePipecatChatEvents from "@/hooks/pipecat-chat-events";
import api from "../utils/api";

interface RealTimeChatPanelProps {
  equipmentId?: string;
  tenantId?: string;
  promptType?: string;
}

export default function RealTimeChatPanel({
  equipmentId,
  tenantId,
  promptType,
}: RealTimeChatPanelProps) {
  // TEST BUILD VERSION 2.0
  const client = usePipecatClient();
  const transportState = usePipecatClientTransportState();

  const [text, setText] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chunksMetadata, setChunksMetadata] = useState<{ [key: string]: ChunkMetadata }>({});
  const [selectedEqId, setSelectedEqId] = useState<string>(equipmentId || "");
  const [isPaused, setIsPaused] = useState(false);
  const [connectionActive, setConnectionActive] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const autoConnectAttemptedRef = useRef(false);

  // Subscribe to Pipecat chat events
  usePipecatChatEvents(setMessages, setChunksMetadata);

  // Keep local selected equipment in sync with incoming equipmentId (e.g. from URL)
  useEffect(() => {
    if (equipmentId && equipmentId !== selectedEqId) {
      setSelectedEqId(equipmentId);
      autoConnectAttemptedRef.current = false;
    }
  }, [equipmentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (endRef.current) {
      endRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const isConnecting =
    transportState === TransportStateEnum.CONNECTING || transportState === TransportStateEnum.AUTHENTICATING;
  // Check for READY state, but also allow CONNECTED as a fallback
  // Also check if we're in a state where the connection is established (even if not READY yet)
  // On HTTP (no HTTPS), mic access fails and transport may go to DISCONNECTED
  // even though WebSocket is still working and bot messages are flowing.
  // Use connectionActive flag + messages as fallback to enable UI controls.
  const isConnected =
    transportState === TransportStateEnum.READY ||
    transportState === TransportStateEnum.CONNECTED ||
    (connectionActive && messages.length > 0);

  // Track if we've ever been connected (to show mic toggle even if state temporarily changes)
  const [hasBeenConnected, setHasBeenConnected] = useState(false);

  useEffect(() => {
    if (isConnected) {
      setHasBeenConnected(true);
    } else if (transportState === TransportStateEnum.DISCONNECTED) {
      setHasBeenConnected(false);
    }
  }, [isConnected, transportState, messages.length]);

  // Log transport state changes for debugging
  useEffect(() => {
    console.log("Transport state changed:", transportState);
    console.log("isConnecting:", isConnecting, "isConnected:", isConnected);
  }, [transportState, isConnecting, isConnected]);

  useRTVIClientEvent(RTVIEvent.BotReady, () => {
    console.log("✅ Bot is ready - connection established");
  });

  useRTVIClientEvent(RTVIEvent.Ready, () => {
    console.log("✅ Transport is ready");
  });

  useRTVIClientEvent(RTVIEvent.Error, (error: any) => {
    console.error("❌ Connection error:", error);
  });

  useRTVIClientEvent(RTVIEvent.Connected, () => {
    console.log("✅ WebSocket connected");
  });

  useRTVIClientEvent(RTVIEvent.Disconnected, () => {
    console.log("⚠️ WebSocket disconnected");
  });

  const handleConnect = async () => {
    const eqId = selectedEqId || equipmentId;
    if (!eqId) {
      alert("Please select a machine/equipment");
      return;
    }

    // Check if already connected or connecting, disconnect first
    if (transportState !== TransportStateEnum.DISCONNECTED && transportState !== TransportStateEnum.DISCONNECTING) {
      console.log("Client already connected/connecting, disconnecting first...");
      try {
        await handleDisconnect();
        // Wait a bit for disconnect to complete
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error("Error during disconnect before reconnect:", error);
      }
    }

    const endpoint = import.meta.env.VITE_PIPECAT_ENDPOINT || "/stream/connect";

    try {
      console.log("Connecting with equipment_id:", eqId);
      console.log("Endpoint:", endpoint);
      console.log("Full URL:", `${api.defaults.baseURL}${endpoint}`);

      const response = await api.post(endpoint, {
        equipment_id: eqId,
        ...(tenantId ? { tenant_id: tenantId } : {}),
        ...(promptType ? { prompt_type: promptType } : {}),
      });

      console.log("Connection response:", response.data);
      console.log("WebSocket URL from response:", response.data?.ws_url);
      console.log("Attempting to connect client...");
      setConnectionActive(true);

      if (!client) {
        throw new Error("Pipecat client not initialized");
      }
      // Verify we have a ws_url
      if (!response.data?.ws_url) {
        throw new Error("No ws_url in connection response");
      }

      // Wrap connect in try-catch to handle any initialization errors
      try {
        console.log("Calling client.connect() with:", response.data);
        const connectResult = await client.connect(response.data);
        console.log("Client.connect() completed, result:", connectResult);
        console.log("Client.connect() called, waiting for transport state update...");
      } catch (connectError: any) {
        console.error("❌ Error during client.connect():", connectError);
        console.error("Error details:", {
          message: connectError?.message,
          stack: connectError?.stack,
          name: connectError?.name,
          toString: connectError?.toString()
        });

        // Handle specific errors like enumerateDevices
        if (connectError?.message?.includes("enumerateDevices") ||
          connectError?.toString().includes("enumerateDevices")) {
          console.warn("⚠️ Microphone access error (this is expected if not using HTTPS or microphone not available):", connectError);
          // Try to connect anyway - the client might still work without microphone
          // The error might be non-fatal
          console.log("Attempting to continue connection despite microphone error...");
        } else {
          // Log the error but don't throw - let the connection attempt continue
          console.error("Connection error (non-fatal, continuing):", connectError);
        }
      }

      // Give the client a moment to establish the connection and update state
      // The transport state should transition: CONNECTING -> READY
      // If it doesn't transition within 5 seconds, log a warning
      setTimeout(() => {
        const currentState = transportState;
        console.log("Transport state after 5 seconds:", currentState);
        if (currentState !== TransportStateEnum.READY &&
          currentState !== TransportStateEnum.CONNECTED &&
          currentState !== TransportStateEnum.CONNECTING) {
          console.warn("⚠️ Transport state did not transition to READY. Current state:", currentState);
        }
      }, 5000);
    } catch (error: any) {
      console.error("Failed to connect:", error);
      setConnectionActive(false);
      const errorMessage = error?.response?.data?.detail || error?.message || "Unknown error";
      console.error("Error details:", {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message
      });
      alert(`Connection Error: ${errorMessage}`);
    }
  };

  const handleDisconnect = async () => {
    try {
      if (transportState === TransportStateEnum.DISCONNECTED || transportState === TransportStateEnum.DISCONNECTING) {
        console.log("Already disconnected or disconnecting");
        setHasBeenConnected(false);
        return;
      }
      console.log("Disconnecting client...");
      setConnectionActive(false);
      setHasBeenConnected(false); // Reset connection state
      setIsPaused(false);
      await client?.disconnect();
      console.log("Client disconnected successfully");
      // Wait a moment for state to update
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error: any) {
      if (
        error?.message?.includes("Session ended") ||
        error?.toString().includes("Session ended") ||
        error?.message?.includes("already disconnected")
      ) {
        console.log("Session already ended or disconnected");
        setHasBeenConnected(false);
        return;
      }
      console.error("Failed to disconnect:", error);
      setHasBeenConnected(false);
      setIsPaused(false);
    }
  };

  const handlePauseToggle = () => {
    if (!isConnected) return;
    setIsPaused((prev) => !prev);
  };

  const handleRestart = async () => {
    const eqId = selectedEqId || equipmentId;
    if (!eqId) return;

    try {
      await handleDisconnect();
      setMessages([]);
      setChunksMetadata({});
      setText("");
      setIsPaused(false);
      autoConnectAttemptedRef.current = false;

      await new Promise((resolve) => setTimeout(resolve, 400));
      await handleConnect();
    } catch (error) {
      console.error("Failed to restart chat:", error);
    }
  };

  useEffect(() => {
    const eqId = selectedEqId || equipmentId;
    if (!eqId || autoConnectAttemptedRef.current) return;
    if (transportState !== TransportStateEnum.DISCONNECTED) return;

    autoConnectAttemptedRef.current = true;
    void handleConnect();
  }, [selectedEqId, equipmentId, transportState]);

  const handleSendText = async () => {
    const payload = text.trim();
    if (!payload || !client) return;

    await client.sendText(payload);

    setMessages((prev) => [
      ...prev,
      { id: getId(), role: "user", content: payload, timestamp: new Date() },
    ]);
    setText("");
  };

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg border bg-slate-700 border-slate-600">
            <Bot className="h-4 w-4 text-slate-200" />
          </div>
          <div className="flex flex-col gap-1">
            <h3 className="text-lg font-semibold text-slate-100">Your AI Assistant</h3>
            <p className="text-xs text-slate-400">Live conversation</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 text-xs rounded-lg border bg-slate-800 text-slate-300 border-slate-700">
            KB: {selectedEqId ? `${selectedEqId.slice(0, 8)}...` : "Not selected"}
          </div>

          {/* Mic Toggle - Show when connected or has been connected (to handle state transitions) */}
          {(isConnected || hasBeenConnected) && (
            <PipecatClientMicToggle disabled={!isConnected || isPaused}>
              {({ disabled, isMicEnabled, onClick }) => (
                <button
                  disabled={disabled}
                  onClick={onClick}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${isMicEnabled
                    ? "text-green-400 border-green-800 bg-green-900/30"
                    : "text-red-400 border-red-800 bg-red-900/30"
                    } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
                  title={isMicEnabled ? "Microphone enabled" : "Microphone disabled"}
                >
                  {isMicEnabled ? <Mic className="h-3.5 w-3.5" /> : <MicOff className="h-3.5 w-3.5" />}
                </button>
              )}
            </PipecatClientMicToggle>
          )}

          {!isConnected ? (
            <button
              onClick={handleConnect}
              disabled={isConnecting || !selectedEqId}
              className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-all disabled:opacity-40 bg-blue-600 hover:bg-blue-700"
            >
              <Play className="h-3.5 w-3.5 inline mr-1" />
              {isConnecting ? "Connecting" : "Start"}
            </button>
          ) : (
            <>
              <button
                onClick={handlePauseToggle}
                className={`px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-all ${isPaused ? "bg-amber-600 hover:bg-amber-700" : "bg-slate-600 hover:bg-slate-500"}`}
              >
                <PauseCircle className="h-3.5 w-3.5 inline mr-1" />
                {isPaused ? "Resume" : "Pause"}
              </button>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-all bg-red-600 hover:bg-red-700"
              >
                <StopCircle className="h-3.5 w-3.5 inline mr-1" />
                Stop
              </button>
              <button
                onClick={handleRestart}
                className="px-3 py-1.5 text-xs font-medium text-white rounded-lg transition-all bg-violet-600 hover:bg-violet-700"
              >
                <RotateCcw className="h-3.5 w-3.5 inline mr-1" />
                Restart
              </button>
            </>
          )}

          {/* Status Badge */}
          <div className={`px-2.5 py-1 text-xs rounded-lg border ${isConnecting
            ? "bg-yellow-900/30 text-yellow-500 border-yellow-800"
            : isConnected
              ? "bg-green-900/30 text-green-500 border-green-800"
              : "bg-slate-800 text-slate-400 border-slate-700"
            }`}>
            <div className="flex items-center gap-1.5">
              <div className={`h-1.5 w-1.5 rounded-full ${isConnecting
                ? "bg-yellow-500 animate-pulse"
                : isConnected
                  ? "bg-green-500 animate-pulse"
                  : "bg-slate-500"
                }`} />
              <span>
                {isConnecting ? "Connecting..." : isConnected ? (isPaused ? "Paused" : "Connected") : "Idle"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden audio element */}
      <div style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }}>
        <PipecatClientAudio />
      </div>

      {/* Chat Messages */}
      <div
        ref={listRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4 bg-slate-900"
      >
        {messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center space-y-4">
              <div className="inline-flex p-4 rounded-full bg-slate-800 border border-slate-700">
                <Bot className="h-8 w-8 text-slate-400" />
              </div>
              <div>
                <p className="text-sm text-slate-200 font-medium">No messages yet</p>
                <p className="text-xs text-slate-500 mt-1">Speak or type to start a conversation</p>
              </div>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            if (m.role === "bot") {
              return (
                <BotMessageBubble
                  key={m.id}
                  message={m}
                  chunksMetadata={chunksMetadata}
                />
              );
            }
            return <UserMessageBubble key={m.id} message={m} />;
          })
        )}
        <div ref={endRef} />
      </div>

      {/* Chat Input */}
      <div className="border-t border-slate-700 bg-slate-800 p-4">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={isConnected ? (isPaused ? "Chat paused. Resume to continue..." : "Send a message...") : "Connect to send messages"}
            disabled={!isConnected || isPaused}
            className="flex-1 px-4 py-2.5 text-sm rounded-xl border border-slate-600 bg-slate-700 text-slate-100 placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter" && isConnected && !isPaused && text.trim()) {
                handleSendText();
              }
            }}
          />
          <button
            onClick={handleSendText}
            disabled={!text.trim() || !isConnected || isPaused}
            className="p-2.5 rounded-xl text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


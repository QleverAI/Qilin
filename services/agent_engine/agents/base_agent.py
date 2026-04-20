import asyncio
import json
import logging
import time

import anthropic

log = logging.getLogger(__name__)

_TOOL_PREFIX = "_tool_"


class BaseAgent:
    model = "claude-haiku-4-5-20251001"
    timeout_seconds = 30

    def __init__(self, name: str, tools: list, system_prompt: str) -> None:
        self.name = name
        self.client = anthropic.AsyncAnthropic()
        self.tools = tools
        self.system_prompt = system_prompt

    async def run(self, context: dict) -> dict:
        start_ms = int(time.monotonic() * 1000)
        tools_called: list[str] = []
        result: dict | None = None
        error: str | None = None

        try:
            messages: list[dict] = [
                {"role": "user", "content": json.dumps(context, ensure_ascii=False)}
            ]
            result = await asyncio.wait_for(
                self._agent_loop(messages, tools_called),
                timeout=self.timeout_seconds,
            )
        except asyncio.TimeoutError:
            error = f"Timeout after {self.timeout_seconds}s"
            log.warning("[AGENT-ENGINE] %s timeout", self.name)
        except Exception as exc:
            error = str(exc)
            log.error("[AGENT-ENGINE] %s error: %s", self.name, exc)

        return {
            "agent_name": self.name,
            "success": error is None,
            "result": result,
            "error": error,
            "duration_ms": int(time.monotonic() * 1000) - start_ms,
            "tools_called": tools_called,
        }

    async def _agent_loop(
        self, messages: list[dict], tools_called: list[str]
    ) -> dict:
        msgs = list(messages)

        while True:
            response = await self.client.messages.create(
                model=self.model,
                max_tokens=2048,
                system=self.system_prompt,
                tools=self.tools if self.tools else [],
                messages=msgs,
            )

            if response.stop_reason == "end_turn":
                for block in response.content:
                    if hasattr(block, "text"):
                        try:
                            return json.loads(block.text)
                        except (json.JSONDecodeError, ValueError):
                            return {"raw": block.text}
                return {}

            if response.stop_reason == "tool_use":
                tool_results = []
                for block in response.content:
                    if block.type == "tool_use":
                        tools_called.append(block.name)
                        result_str = await self._execute_tool(block.name, block.input)
                        tool_results.append(
                            {
                                "type": "tool_result",
                                "tool_use_id": block.id,
                                "content": result_str,
                            }
                        )
                msgs.append({"role": "assistant", "content": response.content})
                msgs.append({"role": "user", "content": tool_results})
                continue

            # Unexpected stop reason
            return {}

    async def _execute_tool(self, tool_name: str, tool_input: dict) -> str:
        """Dispatch to _tool_<name> method on the subclass."""
        method = getattr(self, f"{_TOOL_PREFIX}{tool_name}", None)
        if method is None:
            return json.dumps({"error": f"Tool '{tool_name}' not implemented"})
        try:
            result = await method(tool_input)
            return json.dumps(result) if not isinstance(result, str) else result
        except Exception as exc:
            log.warning("[AGENT-ENGINE] Tool %s error: %s", tool_name, exc)
            return json.dumps({"error": str(exc)})

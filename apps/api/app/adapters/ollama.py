import base64
import json
from urllib.parse import urlparse

import httpx

from app.application.assistant import ModelResult
from app.assistant_contracts import AIContent
from app.domain.errors import BusinessError


class OllamaDraftModel:
    def __init__(self, url: str, model: str, allow_remote=False):
        parsed = urlparse(url)
        if (
            parsed.scheme not in ("http", "https")
            or parsed.username
            or parsed.password
            or parsed.query
            or parsed.fragment
        ):
            raise ValueError("Invalid assistant endpoint")
        if parsed.hostname not in ("127.0.0.1", "localhost", "::1") and (
            not allow_remote or parsed.scheme != "https"
        ):
            raise ValueError("Remote AI needs explicit operator configuration and HTTPS")
        self.url, self.model = url.rstrip("/"), model

    def generate(self, system: str, context: str, images: list[bytes]) -> ModelResult:
        # Some vision-model templates do not retain a separate system message.
        # Repeat the trusted task after a clearly delimited record block.
        message = {
            "role": "user",
            "content": "<records>\n" + context + "\n</records>\nTrusted task:\n" + system,
        }
        if images:
            message["images"] = [base64.b64encode(image).decode() for image in images]
        payload = {
            "model": self.model,
            "stream": False,
            "think": False,
            "format": AIContent.model_json_schema(by_alias=True),
            "messages": [{"role": "system", "content": system}, message],
            "options": {"temperature": 0, "num_predict": 2200, "num_ctx": 16384},
            "keep_alive": "2m",
        }
        try:
            with httpx.Client(timeout=httpx.Timeout(75, connect=4), trust_env=False) as client:
                response = client.post(self.url + "/api/chat", json=payload)
                response.raise_for_status()
                if len(response.content) > 200000:
                    raise ValueError("Oversized model output")
                body = response.json()
                if not body.get("done") or body.get("done_reason") == "length":
                    raise ValueError("Incomplete model output")
                content = AIContent.model_validate_json(body["message"]["content"])
                return ModelResult(
                    content, int(body.get("prompt_eval_count", 0)), int(body.get("eval_count", 0))
                )
        except (httpx.HTTPError, ValueError, KeyError, json.JSONDecodeError) as error:
            raise BusinessError(
                "AI_UNAVAILABLE",
                "The assistant could not prepare a reliable draft. Your normal workflow remains available.",
                503,
            ) from error

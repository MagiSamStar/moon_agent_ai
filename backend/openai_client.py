import os

import certifi
import httpx
from langchain_openai import ChatOpenAI


os.environ.setdefault("SSL_CERT_FILE", certifi.where())
os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())


def _ssl_verify() -> bool | str:
    value = os.getenv("MOON_AGENT_SSL_VERIFY", "true").strip().lower()
    if value in {"0", "false", "no", "off"}:
        return False
    return certifi.where()


def create_chat_model(model: str) -> ChatOpenAI:
    verify = _ssl_verify()
    return ChatOpenAI(
        model=model,
        http_client=httpx.Client(verify=verify),
        http_async_client=httpx.AsyncClient(verify=verify),
    )

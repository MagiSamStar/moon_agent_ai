import os
import certifi
import httpx
from langchain_openai import ChatOpenAI
from openai import OpenAI


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


class OpenAIEmbeddingClient:
    def __init__(self, model: str, verify: bool | str):
        self.model = model
        self.client = OpenAI(http_client=httpx.Client(verify=verify))

    def embed_query(self, text: str) -> list[float]:
        response = self.client.embeddings.create(
            model=self.model,
            input=text,
        )
        return response.data[0].embedding


def create_embedding_model(model: str | None = None) -> OpenAIEmbeddingClient:
    verify = _ssl_verify()
    return OpenAIEmbeddingClient(
        model=model or os.getenv("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"),
        verify=verify,
    )

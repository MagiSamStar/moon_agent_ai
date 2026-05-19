from typing import Optional


GREETING_RESPONSE = (
    "Hello, how are you doing today? "
    "What Moon wisdom can I help you with?"
)

THANK_YOU_RESPONSE = "You're Welcome, Do you need additonal Moon Guidance or wisdom for the week?"

_GREETING_INPUTS = {"hi", "namaste"}
_THANK_YOU_INPUTS = {"thank you", "thanks", "thank u"}


def get_direct_response(message: str) -> Optional[str]:
    """Return a deterministic response for simple non-LLM intents."""
    normalized = message.strip().casefold().rstrip("!.?")

    if normalized in _GREETING_INPUTS:
        return GREETING_RESPONSE
    if normalized in _THANK_YOU_INPUTS:
        return THANK_YOU_RESPONSE

    return None

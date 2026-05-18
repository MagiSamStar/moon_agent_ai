from pydantic import BaseModel, Field
from langchain_openai import ChatOpenAI


class AffirmationCard(BaseModel):
    card_title: str = Field(description="Short title for the affirmation card")
    affirmation: str = Field(description="One strong first-person affirmation")
    caption: str = Field(description="One sentence explaining the energy")
    visual_prompt: str = Field(description="Prompt for generating the card image")
    palette: list[str] = Field(description="3-5 hex colors for the card")


llm = ChatOpenAI(model="gpt-5-mini")


async def create_affirmation_card(moon_guidance: str) -> AffirmationCard:
    creative_llm = llm.with_structured_output(AffirmationCard)

    prompt = f"""
Create a single affirmation card based on the following moon guidance.

The card should include:
- A short title
- One strong first-person affirmation
- A one-sentence caption explaining the energy of the day
- A visual prompt for generating a tarot-card-inspired image
- A palette of 3-5 hex colors that represent the energy of the day

Keep the affirmation spiritual, grounded, and practical. Use the guidance to
inspire both the card content and the visual design.

Moon guidance:
{moon_guidance}
"""

    return await creative_llm.ainvoke(prompt)

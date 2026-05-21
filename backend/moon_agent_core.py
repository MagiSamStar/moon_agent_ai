import asyncio
import json
import os
from pathlib import Path
import sys
from typing import Annotated, Any, List, Literal, Optional, Sequence
import dotenv
from fastmcp import Client
from fastmcp.client.transports import PythonStdioTransport
from langchain.tools import tool
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from pydantic import BaseModel, Field
from typing_extensions import TypedDict
from openai_client import create_chat_model
try:
    from .responses import get_direct_response
except ImportError:
    from responses import get_direct_response


BASE_DIR = Path(__file__).resolve().parent
REPO_ROOT = BASE_DIR.parent
dotenv.load_dotenv(REPO_ROOT / ".env")
dotenv.load_dotenv(BASE_DIR / ".env", override=True)

MCP_SERVER = BASE_DIR / "stdio_server.py"
PYTHON_EXE = os.getenv("MOON_AGENT_PYTHON") or sys.executable

# USER_PROFILE = {
#     "name": "SamStar",
#     "goals": ["study AI", "build portfolio", "job search"],
#     "preferred_planning_style": "spiritual but practical",
#     "default_calendar_delay_hours": 2,
# }

USER_PROFILE = {
         "name": "Demo User",
         "goals": ["plan the day", "build focus", "reflect intentionally"],
         "preferred_planning_style": "spiritual but practical",
         "default_calendar_delay_hours": 2,
     }


@tool
def get_moon() -> dict:
    """Get the current moon phase and illumination data."""
    raise RuntimeError("Tool execution is handled by the MCP stdio server.")


@tool
def get_planet() -> dict:
    """Get the current planetary moon data, including sign and house details."""
    raise RuntimeError("Tool execution is handled by the MCP stdio server.")


@tool
def create_calendar_event(
    title: str,
    description: str,
    hours_from_now: int = 2,
) -> str:
    """Create a Google Calendar event."""
    raise RuntimeError("Tool execution is handled by the MCP stdio server.")


@tool
def create_notion_page(title: str, content: str) -> str:
    """Create a Notion page."""
    raise RuntimeError("Tool execution is handled by the MCP stdio server.")


@tool
def create_notion_database_entry(title: str, content: str) -> str:
    """Create a Notion database entry."""
    raise RuntimeError("Tool execution is handled by the MCP stdio server.")


tools = [
    get_moon,
    get_planet,
    create_calendar_event,
    create_notion_page,
    create_notion_database_entry,
]

llm = create_chat_model(model="gpt-5-mini")

chat_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
You are Moon Planner Agent, a spiritual but grounded assistant.

You help the user understand the general current moon energy and turn that guidance into useful daily planning.

You have these tools:
- get_moon: use for moon phase and illumination.
- get_planet: use for moon sign, house, and planetary moon data.
- create_calendar_event: use to create Google Calendar events.
- create_notion_page: use to save moon guidance, plans, reflections, or affirmations to Notion.
- create_notion_database_entry: use to save moon guidance, plans, reflections, or affirmations as a Notion database row.
-When a tool returns a Notion or Calendar URL, always show it as a Markdown link.
use exactly:  
[Open in Notion](URL)
[Open in Calendar](URL)
Never display raw URLs by themselves.

Planning Rules:
- When creating a plan, use the user's profile, goals, and current moon energy.
- Choose a plan_type: daily, weekly, career, creative, healing, or productivity.
- If the user asks for planning guidance, create a practical plan with 3-5 tasks.
- If calendar scheduling is requested, suggest calendar blocks first unless the user clearly says to add it now.
- If Notion saving is requested, create a clear Notion page title and concise page content.
- Prefer create_notion_database_entry when the user asks to save to a Notion database.
- Always explain the energy_theme in simple grounded language.

 When giving tasks, format them as a checklist using:
  - [ ] Task text
  - [ ] Task text
  - [ ] Task text

  Do not write tasks inline as “1) ... 2) ...”.

  example:
  Today’s focus: steady progress.
  - [ ] Review your AI portfolio for 25 minutes.
  - [ ] Save one reflection to Notion.
  - [ ] Block one calendar session for focused study.


Rules:
1. When the user asks about the moon, moon sign, moon phase, moon energy, or guidance, use get_moon and get_planet.
2. Give clear, grounded spiritual guidance based on the tool data.
3. Always include one healing affirmation.
4. If the user asks to plan, schedule, create a task, add to calendar, or says yes after you suggest scheduling, you MUST call create_calendar_event.
5. If the user asks to save, add, write, or send something to a Notion database, you MUST call create_notion_database_entry.
6. If the user asks to save, add, write, or send something to a regular Notion page, you MUST call create_notion_page.
7. Do not say you added something to the calendar or Notion unless the matching tool was actually called.
8. When calling create_calendar_event:
   - title should be short and clear.
   - description should include the moon guidance.
   - hours_from_now should be an integer.
   - If the user does not give a time, choose 2 hours from now.
9. If the user asks for a plan but not a calendar event or Notion page/database, give a suggested plan and ask if they want it saved or scheduled.

DO NOT:
do not answer any questions unless they are specifically about the moon, zodiac sign, astorogy houses, planning, scheduling, or saving to Notion.
if a user ask a question that is not about the moon, zodiac sign, planning, scheduling, or saving to Notion, respond with:
"I'm here to help with moon guidance and planning. Could you please ask me about the moon and its phases?"

Tone:
- Warm
- Spiritual
- Encouraging
- Practical
- Not too long
""",
        ),
        MessagesPlaceholder(variable_name="scratch_pad"),
    ]
)

reflection_prompt = ChatPromptTemplate.from_messages(
    [
        (
            "system",
            """
You are a skilled editor of spiritual moon readings.

Your goal is to refine the message while preserving its meaning and emotional tone.

Improve the text by:
- Making it clear, concise, and easy to follow
- Keeping a spiritual, grounded, and supportive tone
- Removing repetition, fluff, or vague wording
- Strengthening emotional impact and readability

Enhance the structure:
- Keep it to 2-4 short paragraphs maximum
- Ensure it flows naturally from insight to guidance to affirmation

Important:
- Do NOT change the core meaning
- Do NOT add new ideas that were not present
- Do NOT remove the healing affirmation
- Keep the message personal and direct

Return ONLY the improved version.
""",
        ),
        ("human", "{draft}"),
    ]
)

model_react = chat_prompt | llm.bind_tools(tools)


class CalendarBlock(BaseModel):
    title: str
    description: str
    hours_from_now: int = 2


class MoonPlan(BaseModel):
    plan_type: Literal["daily", "weekly", "career", "creative", "healing", "productivity"]
    energy_theme: str
    guidance: str
    tasks: List[str]
    reflection_prompt: str
    affirmation: str
    calendar_blocks: List[CalendarBlock] = Field(default_factory=list)


class AgentState(TypedDict):
    """The state of the Agent."""

    messages: Annotated[Sequence[BaseMessage], add_messages]
    user_profile: dict
    plan_preview: Optional[dict]


def _jsonable(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    if isinstance(value, list):
        return [_jsonable(item) for item in value]
    if isinstance(value, tuple):
        return [_jsonable(item) for item in value]
    if isinstance(value, dict):
        return {key: _jsonable(item) for key, item in value.items()}
    return value


def _tool_message_content(value: Any) -> str:
    return json.dumps(_jsonable(value), default=str)


async def reflect_node(state: AgentState):
    last_message = state["messages"][-1]

    if not isinstance(last_message, AIMessage):
        return {"messages": []}

    response = await llm.ainvoke(
        reflection_prompt.format_messages(draft=last_message.content)
    )

    return {"messages": [AIMessage(content=response.content)]}


def make_tool_node(mcp_client: Client):
    async def tool_node(state: AgentState):
        """Execute requested tool calls through the persistent MCP stdio client."""
        outputs = []

        for tool_call in state["messages"][-1].tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call.get("args", {})
            tool_result = await mcp_client.call_tool(tool_name, tool_args)
            outputs.append(
                ToolMessage(
                    content=_tool_message_content(tool_result),
                    name=tool_name,
                    tool_call_id=tool_call["id"],
                )
            )

        return {"messages": outputs}

    return tool_node


async def call_llm(state: AgentState):
    """Invoke the model with the current conversation state."""
    user_profile = state.get("user_profile", USER_PROFILE)
    profile_message = SystemMessage(
        content=f"""
User profile:
{json.dumps(user_profile, indent=2)}

Use this profile to personalize the moon planning guidance.
"""
    )

    response = await model_react.ainvoke(
        {"scratch_pad": [profile_message] + list(state["messages"])}
    )

    return {"messages": [response]}


def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    return "continue" if last_message.tool_calls else "end"


def build_graph(mcp_client: Client):
    workflow = StateGraph(AgentState)

    workflow.add_node("agent", call_llm)
    workflow.add_node("tool", make_tool_node(mcp_client))
    workflow.add_node("reflect", reflect_node)
    workflow.add_edge("reflect", END)
    workflow.add_edge("tool", "agent")
    workflow.add_conditional_edges(
        "agent",
        should_continue,
        {
            "continue": "tool",
            "end": "reflect",
        },
    )
    workflow.set_entry_point("agent")
    return workflow.compile()


async def create_moon_graph():
    transport = PythonStdioTransport(
        script_path=MCP_SERVER,
        python_cmd=str(PYTHON_EXE),
        cwd=str(BASE_DIR),
        env=dict(os.environ),
    )
    client = Client(transport)
    await client.__aenter__()
    graph = build_graph(client)
    return graph, client


async def process_message(graph, conversation, user_message: str):
    conversation.append(HumanMessage(content=user_message))

    direct_response = get_direct_response(user_message)
    if direct_response:
        conversation.append(AIMessage(content=direct_response))
        return direct_response, conversation

    result = await graph.ainvoke(
        {
            "messages": conversation,
            "user_profile": USER_PROFILE,
            "plan_preview": None,
        }
    )

    updated_conversation = list(result["messages"])

    ai_messages = [
        message for message in updated_conversation
        if isinstance(message, AIMessage)
    ]

    response_text = ai_messages[-1].content if ai_messages else ""

    return response_text, updated_conversation

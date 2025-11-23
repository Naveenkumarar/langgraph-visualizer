"""
Multi-Agent Supervisor Example
Demonstrates a supervisor architecture where specialized agents are coordinated by a central supervisor
"""

from typing import Annotated, Literal
from langchain_core.tools import tool, InjectedToolCallId
from langchain_tavily import TavilySearch
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent, InjectedState
from langgraph.graph import StateGraph, START, END, MessagesState
from langgraph.types import Command


# ============= Tool Definitions =============

# Web search tool for research agent
web_search = TavilySearch(max_results=3)


@tool
def add(a: float, b: float):
    """Add two numbers."""
    return a + b


@tool
def multiply(a: float, b: float):
    """Multiply two numbers."""
    return a * b


@tool
def divide(a: float, b: float):
    """Divide two numbers."""
    return a / b


# ============= Worker Agents =============

# Research agent with web search capability
research_agent = create_react_agent(
    model="openai:gpt-4.1",
    tools=[web_search],
    prompt=(
        "You are a research agent.\n\n"
        "INSTRUCTIONS:\n"
        "- Assist ONLY with research-related tasks, DO NOT do any math\n"
        "- After you're done with your tasks, respond to the supervisor directly\n"
        "- Respond ONLY with the results of your work, do NOT include ANY other text."
    ),
    name="research_agent",
)

# Math agent with calculation tools
math_agent = create_react_agent(
    model="openai:gpt-4.1",
    tools=[add, multiply, divide],
    prompt=(
        "You are a math agent.\n\n"
        "INSTRUCTIONS:\n"
        "- Assist ONLY with math-related tasks\n"
        "- After you're done with your tasks, respond to the supervisor directly\n"
        "- Respond ONLY with the results of your work, do NOT include ANY other text."
    ),
    name="math_agent",
)


# ============= Handoff Tools =============


def create_handoff_tool(*, agent_name: str, description: str | None = None):
    """Create a handoff tool to transfer control to another agent."""
    name = f"transfer_to_{agent_name}"
    description = description or f"Ask {agent_name} for help."

    @tool(name, description=description)
    def handoff_tool(
        state: Annotated[MessagesState, InjectedState],
        tool_call_id: Annotated[str, InjectedToolCallId],
    ) -> Command:
        tool_message = {
            "role": "tool",
            "content": f"Successfully transferred to {agent_name}",
            "name": name,
            "tool_call_id": tool_call_id,
        }
        return Command(
            goto=agent_name,  # Navigate to the target agent
            update={**state, "messages": state["messages"] + [tool_message]},
            graph=Command.PARENT,  # Indicate parent graph navigation
        )

    return handoff_tool


# Create handoff tools for supervisor
assign_to_research_agent = create_handoff_tool(
    agent_name="research_agent",
    description="Assign task to a researcher agent.",
)

assign_to_math_agent = create_handoff_tool(
    agent_name="math_agent",
    description="Assign task to a math agent.",
)


# ============= Supervisor Agent =============

supervisor_agent = create_react_agent(
    model="openai:gpt-4.1",
    tools=[assign_to_research_agent, assign_to_math_agent],
    prompt=(
        "You are a supervisor managing two agents:\n"
        "- a research agent. Assign research-related tasks to this agent\n"
        "- a math agent. Assign math-related tasks to this agent\n"
        "Assign work to one agent at a time, do not call agents in parallel.\n"
        "Do not do any work yourself."
    ),
    name="supervisor",
)


# ============= Supervisor Routing Logic =============


def should_continue(
    state: MessagesState,
) -> Literal["research_agent", "math_agent", "end"]:
    """Determine if we should route to an agent or end."""
    messages = state["messages"]
    last_message = messages[-1]

    # Check if the last message is from supervisor calling a tool
    if hasattr(last_message, "tool_calls") and last_message.tool_calls:
        tool_name = last_message.tool_calls[0]["name"]
        if "research_agent" in tool_name:
            return "research_agent"
        elif "math_agent" in tool_name:
            return "math_agent"

    # If no more work, end
    return "end"


# ============= Multi-Agent Graph =============

# Build the supervisor graph
supervisor = StateGraph(MessagesState)

# Add nodes
supervisor.add_node("supervisor", supervisor_agent)
supervisor.add_node("research_agent", research_agent)
supervisor.add_node("math_agent", math_agent)

# Add edges
supervisor.add_edge(START, "supervisor")

# Conditional routing from supervisor
supervisor.add_conditional_edges(
    "supervisor",
    should_continue,
    {
        "research_agent": "research_agent",
        "math_agent": "math_agent",
        "end": END,
    },
)

# Worker agents always return to supervisor
supervisor.add_edge("research_agent", "supervisor")
supervisor.add_edge("math_agent", "supervisor")

# Compile the graph
app = supervisor.compile()


# ============= Example Usage =============

if __name__ == "__main__":
    # Example query that requires both agents
    test_query = {
        "messages": [
            {
                "role": "user",
                "content": (
                    "find US and New York state GDP in 2024. "
                    "what % of US GDP was New York state?"
                ),
            }
        ]
    }

    print("=" * 60)
    print("Multi-Agent Supervisor Example")
    print("=" * 60)
    print(f"\nQuery: {test_query['messages'][0]['content']}")
    print("\nExpected flow:")
    print("1. Supervisor receives query")
    print("2. Supervisor assigns research task to research_agent")
    print("3. Research agent searches for GDP data")
    print("4. Research agent returns results to supervisor")
    print("5. Supervisor assigns calculation to math_agent")
    print("6. Math agent calculates percentage")
    print("7. Math agent returns result to supervisor")
    print("8. Supervisor provides final answer")
    print("=" * 60)

    # Uncomment to run:
    # for chunk in app.stream(test_query):
    #     print(chunk)

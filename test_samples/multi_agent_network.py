"""
Multi-agent Network Example
This example demonstrates a sophisticated multi-agent workflow with:
- Research agent using TavilySearch tool
- Chart generation agent using PythonREPL tool
- Conditional routing between agents
- React agents with tool binding
"""

from typing import Annotated, Literal
from typing_extensions import TypedDict

from langchain_anthropic import ChatAnthropic
from langchain_community.tools.tavily_search import TavilySearchResults
from langchain_core.messages import BaseMessage
from langchain_experimental.utilities import PythonREPL
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import create_react_agent
from langchain_core.tools import tool


# Tool definitions
tavily_tool = TavilySearchResults(max_results=5)

# Python REPL tool with @tool decorator
repl = PythonREPL()

@tool
def weather_tool(location: str) -> str:
    """Get weather information for a location"""
    return f"Weather in {location}: Sunny, 72°F"

@tool
def python_repl_tool(
    code: Annotated[str, "The python code to execute to generate your chart."],
):
    """Use this to execute python code. If you want to see the output of a value,
    you should print it out with `print(...)`. This is visible to the user."""
    try:
        result = repl.run(code)
    except BaseException as e:
        return f"Failed to execute. Error: {repr(e)}"
    result_str = f"Successfully executed:\n```python\n{code}\n```\nStdout: {result}"
    return result_str


# State definition
class State(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


# System prompt utility
def make_system_prompt(suffix: str) -> str:
    return (
        "You are a helpful AI assistant, collaborating with other assistants."
        " Use the provided tools to progress towards answering the question."
        " If you are unable to fully answer, that's OK, another assistant with different tools "
        " will help where you left off. Execute what you can to make progress."
        " If you or any of the other assistants have the final answer or deliverable,"
        " prefix your response with FINAL ANSWER so the team knows to stop."
        f"\n{suffix}"
    )


# LLM setup
llm = ChatAnthropic(model="claude-3-5-sonnet-20241022")

# Create research agent
research_agent = create_react_agent(
    llm,
    tools=[tavily_tool],
    state_modifier=make_system_prompt(
        "You can search the web to answer questions. "
        "You should research the question and provide accurate information."
    ),
)


# Create chart generation agent
chart_agent = create_react_agent(
    llm,
    tools=[python_repl_tool],
    state_modifier=make_system_prompt(
        "You can use Python to create charts and visualizations. "
        "Make sure to use matplotlib or similar libraries and save/display results."
    ),
)


# Node functions
def research_node(state: State) -> State:
    """Research node that uses the research agent with web search."""
    result = research_agent.invoke(state)
    return {
        "messages": [
            result["messages"][-1],
        ],
    }


def chart_node(state: State) -> State:
    """Chart generation node that uses the chart agent with Python REPL."""
    result = chart_agent.invoke(state)
    return {
        "messages": [
            result["messages"][-1],
        ],
    }


# Router function for conditional edges
def get_next_node(state: State) -> Literal["chart_generator", "researcher", "__end__"]:
    """Determine the next node based on the conversation state."""
    last_message = state["messages"][-1]
    if "FINAL ANSWER" in last_message.content:
        return END

    # Check if we need chart generation
    if any(
        keyword in last_message.content.lower()
        for keyword in ["chart", "graph", "plot", "visualize", "visualization"]
    ):
        return "chart_generator"

    # Default to researcher for more information gathering
    if len(state["messages"]) < 10:  # Limit iterations
        return "researcher"

    return END


# Build the graph
workflow = StateGraph(State)

# Add nodes
workflow.add_node("researcher", research_node)
workflow.add_node("chart_generator", chart_node)
workflow.add_node("weather_tool", weather_tool)

# Add edges
workflow.add_edge(START, "weather_tool")
workflow.add_edge("weather_tool", "researcher")
workflow.add_conditional_edges(
    "researcher",
    get_next_node,
    {
        "chart_generator": "chart_generator",
        "researcher": "researcher",
        END: END,
    },
)
workflow.add_conditional_edges(
    "chart_generator",
    get_next_node,
    {
        "researcher": "researcher",
        END: END,
    },
)

# Compile the graph
memory = MemorySaver()
graph = workflow.compile(checkpointer=memory)


# Example usage
if __name__ == "__main__":
    config = {"configurable": {"thread_id": "1"}}

    events = graph.stream(
        {
            "messages": [
                (
                    "user",
                    "Get the UK's GDP over the past 5 years,"
                    " then make a line chart of it."
                    " Once you code it up, finish.",
                )
            ],
        },
        config,
        stream_mode="values",
    )

    for event in events:
        if "messages" in event:
            event["messages"][-1].pretty_print()

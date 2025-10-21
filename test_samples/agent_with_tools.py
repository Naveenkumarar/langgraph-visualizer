"""
Example LangGraph code with Tools and Agents for testing the visualizer extension
"""

from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_core.tools import tool
from typing import TypedDict, Annotated
from langchain_openai import ChatOpenAI


class AgentState(TypedDict):
    """The state of the agent"""

    messages: list
    current_step: str
    tool_results: list


# Define tools using @tool decorator
@tool
def search_tool(query: str) -> str:
    """Search for information on the web"""
    return f"Search results for: {query}"


@tool
def calculator_tool(expression: str) -> str:
    """Calculate a mathematical expression"""
    try:
        result = eval(expression)
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def weather_tool(location: str) -> str:
    """Get weather information for a location"""
    return f"Weather in {location}: Sunny, 72°F"


# Agent node that uses bind_tools
def agent_node(state: AgentState) -> AgentState:
    """Agent that can use tools via bind_tools"""
    llm = ChatOpenAI(model="gpt-4")
    llm_with_tools = llm.bind_tools([search_tool, calculator_tool, weather_tool])

    # Agent logic here
    response = llm_with_tools.invoke(state["messages"])
    state["messages"].append(response)
    state["current_step"] = "agent"

    return state


# Another agent using tools parameter
def researcher_agent(state: AgentState) -> AgentState:
    """Researcher agent that uses search tool"""
    tools = [search_tool, weather_tool]

    # Research logic
    state["messages"].append("Researching...")
    state["current_step"] = "researcher"

    return state


# Decision node
def should_continue(state: AgentState) -> str:
    """Decide whether to continue or end"""
    if len(state["messages"]) > 5:
        return "end"
    return "tools"


# Regular processing node
def process_results(state: AgentState) -> AgentState:
    """Process the results from tools"""
    state["current_step"] = "process"
    return state


# Create the graph
workflow = StateGraph(AgentState)

# Add agent nodes
workflow.add_node("agent", agent_node)
workflow.add_node("researcher", researcher_agent)

# Add tool node - will be detected as 'tool' type
workflow.add_node("tools", ToolNode([search_tool, calculator_tool, weather_tool]))

# Add regular processing node
workflow.add_node("process", process_results)

# Set entry point
workflow.set_entry_point("agent")

# Add edges
workflow.add_edge("agent", "researcher")

# Add conditional edges from researcher
workflow.add_conditional_edges(
    "researcher", should_continue, {"tools": "tools", "end": "process"}
)

workflow.add_edge("tools", "agent")
workflow.add_edge("process", END)

# Compile the graph
app = workflow.compile()

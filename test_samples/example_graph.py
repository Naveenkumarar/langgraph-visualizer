"""
Example LangGraph code for testing the visualizer extension
"""

from langgraph.graph import StateGraph, END
from typing import TypedDict


class State(TypedDict):
    """The state of the graph"""

    messages: list
    current_step: str


def start_node(state: State) -> State:
    """Starting node"""
    state["messages"].append("Started")
    state["current_step"] = "start"
    return state


def process_node(state: State) -> State:
    """Processing node"""
    state["messages"].append("Processing")
    state["current_step"] = "process"
    return state


def decision_node(state: State) -> str:
    """Decision node that routes to different paths"""
    if len(state["messages"]) > 2:
        return "end"
    else:
        return "continue"


def continue_node(state: State) -> State:
    """Continue processing"""
    state["messages"].append("Continuing")
    state["current_step"] = "continue"
    return state


def end_node(state: State) -> State:
    """Ending node"""
    state["messages"].append("Completed")
    state["current_step"] = "end"
    return state


# Create the graph
workflow = StateGraph(State)

# Add nodes
workflow.add_node("start", start_node)
workflow.add_node("process", process_node)
workflow.add_node("decision", decision_node)
workflow.add_node("continue", continue_node)
workflow.add_node("end", end_node)

# Add edges
workflow.add_edge("start", "process")
workflow.add_edge("process", "decision")

# Add conditional edges
workflow.add_conditional_edges(
    "decision", decision_node, {"end": "end", "continue": "continue"}
)

workflow.add_edge("continue", "process")
workflow.add_edge("end", END)

# Set entry point
workflow.set_entry_point("start")

# Compile the graph
app = workflow.compile()

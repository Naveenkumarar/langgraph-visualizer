"""
Example LangGraph with State definition for testing state visualization
"""

from typing import TypedDict
from langgraph.graph import StateGraph


class State(TypedDict):
    """State definition for the graph"""

    messages: list[str]
    user_input: str
    response: str
    iteration_count: int


def process_input(state: State) -> State:
    """Process user input"""
    messages = state.get("messages", [])
    user_input = state.get("user_input", "")
    messages.append(f"Processing: {user_input}")
    return {**state, "messages": messages}


def generate_response(state: State) -> State:
    """Generate a response"""
    messages = state.get("messages", [])
    response = f"Response to: {state.get('user_input', '')}"
    messages.append(response)
    return {**state, "messages": messages, "response": response}


def increment_counter(state: State) -> State:
    """Increment iteration counter"""
    count = state.get("iteration_count", 0)
    return {**state, "iteration_count": count + 1}


# Create graph with state
graph = StateGraph(State)

# Add nodes
graph.add_node("process", process_input)
graph.add_node("generate", generate_response)
graph.add_node("counter", increment_counter)

# Add edges
graph.add_edge("process", "generate")
graph.add_edge("generate", "counter")

# Set entry and finish points
graph.set_entry_point("process")
graph.set_finish_point("counter")

# Compile
compiled = graph.compile()

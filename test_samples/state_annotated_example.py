"""
Example LangGraph with Annotated State definition
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph
from langgraph.graph.message import add_messages


class MessagesState(TypedDict):
    """State with annotated messages field"""

    messages: Annotated[list, add_messages]
    context: str
    current_step: str


def start_conversation(state: MessagesState) -> MessagesState:
    """Start the conversation"""
    return {**state, "current_step": "conversation_started"}


def add_context(state: MessagesState) -> MessagesState:
    """Add context to the state"""
    return {
        **state,
        "context": "Additional context added",
        "current_step": "context_added",
    }


def process_messages(state: MessagesState) -> MessagesState:
    """Process the messages"""
    return {**state, "current_step": "messages_processed"}


# Create graph
graph = StateGraph(MessagesState)

# Add nodes
graph.add_node("start", start_conversation)
graph.add_node("context", add_context)
graph.add_node("process", process_messages)

# Add edges
graph.add_edge("start", "context")
graph.add_edge("context", "process")

# Set entry and finish points
graph.set_entry_point("start")
graph.set_finish_point("process")

# Compile
compiled = graph.compile()

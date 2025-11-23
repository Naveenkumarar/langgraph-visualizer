"""
Example LangGraph with dataclass State definition
"""

from dataclasses import dataclass, field
from langgraph.graph import StateGraph


@dataclass
class GraphState:
    """Dataclass state definition"""

    input_text: str = ""
    processed_text: str = ""
    tokens: list = field(default_factory=list)
    metadata: dict = field(default_factory=dict)
    is_complete: bool = False


def tokenize(state: GraphState) -> GraphState:
    """Tokenize the input"""
    tokens = state.input_text.split()
    return GraphState(**{**state.__dict__, "tokens": tokens})


def process_tokens(state: GraphState) -> GraphState:
    """Process the tokens"""
    processed = " ".join([token.upper() for token in state.tokens])
    return GraphState(**{**state.__dict__, "processed_text": processed})


def finalize(state: GraphState) -> GraphState:
    """Finalize processing"""
    return GraphState(**{**state.__dict__, "is_complete": True})


# Create graph
graph = StateGraph(GraphState)

# Add nodes
graph.add_node("tokenize", tokenize)
graph.add_node("process", process_tokens)
graph.add_node("finalize", finalize)

# Add edges
graph.add_edge("tokenize", "process")
graph.add_edge("process", "finalize")

# Set entry and finish points
graph.set_entry_point("tokenize")
graph.set_finish_point("finalize")

# Compile
compiled = graph.compile()

"""
Simple LangGraph example for testing
"""

from langgraph.graph import StateGraph


def node_a(state):
    """First node"""
    return state


def node_b(state):
    """Second node"""
    return state


def node_c(state):
    """Third node"""
    return state


# Create a simple linear graph
graph = StateGraph()

# Add nodes
graph.add_node("a", node_a)
graph.add_node("b", node_b)
graph.add_node("c", node_c)

# Add edges
graph.add_edge("a", "b")
graph.add_edge("b", "c")

# Set entry and finish points
graph.set_entry_point("a")
graph.set_finish_point("c")

# Compile
compiled = graph.compile()

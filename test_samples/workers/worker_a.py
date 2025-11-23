from langgraph.graph import StateGraph


def worker_a_step1(state):
    """First step of worker A"""
    state["worker_a_step1"] = "completed"
    return state


def worker_a_step2(state):
    """Second step of worker A"""
    state["worker_a_step2"] = "completed"
    return state


def create_worker_a_graph():
    """Create worker A subgraph"""
    graph = StateGraph(dict)

    # Add nodes
    graph.add_node("step1", worker_a_step1)
    graph.add_node("step2", worker_a_step2)

    # Add edges
    graph.add_edge("step1", "step2")

    # Set entry and finish points
    graph.set_entry_point("step1")
    graph.set_finish_point("step2")

    return graph

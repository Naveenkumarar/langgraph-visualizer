from langgraph.graph import StateGraph


def worker_b_step1(state):
    """First step of worker B"""
    state["worker_b_step1"] = "completed"
    return state


def worker_b_step2(state):
    """Second step of worker B"""
    state["worker_b_step2"] = "completed"
    return state


def worker_b_conditional(state):
    """Conditional step for worker B"""
    if state.get("conditional_flag", False):
        return "step2"
    return "finish"


def create_worker_b_graph():
    """Create worker B subgraph with conditional logic"""
    graph = StateGraph(dict)

    # Add nodes
    graph.add_node("step1", worker_b_step1)
    graph.add_node("step2", worker_b_step2)
    graph.add_node("finish", lambda x: x)

    # Add edges
    graph.add_conditional_edges(
        "step1", worker_b_conditional, {"step2": "step2", "finish": "finish"}
    )

    # Set entry and finish points
    graph.set_entry_point("step1")
    graph.set_finish_point("finish")

    return graph

from langgraph.graph import StateGraph
from workers.worker_a import create_worker_a_graph
from workers.worker_b import create_worker_b_graph


def main_process(state):
    """Main processing function that coordinates workers"""
    state["processed"] = True
    return state


def finalize_process(state):
    """Final processing step"""
    state["finalized"] = True
    return state


# Create the main graph
graph = StateGraph(dict)

# Add main nodes
graph.add_node("start", lambda x: {"status": "started"})
graph.add_node("main_process", main_process)
graph.add_node("worker_a", create_worker_a_graph().compile())
graph.add_node("worker_b", create_worker_b_graph().compile())
graph.add_node("finalize", finalize_process)

# Add edges
graph.add_edge("start", "main_process")
graph.add_edge("main_process", "worker_a")
graph.add_edge("worker_a", "worker_b")
graph.add_edge("worker_b", "finalize")

# Set entry and finish points
graph.set_entry_point("start")
graph.set_finish_point("finalize")

# Compile the graph
compiled_graph = graph.compile()

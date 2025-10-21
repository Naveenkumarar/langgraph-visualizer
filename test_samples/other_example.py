"""
LangGraph State Management and Graph Creation Tutorial
This script provides an interactive demonstration of state management and graph creation
using LangGraph, a library for building stateful agentic workflows with language models.
Key Concepts Demonstrated:
1. Basic and Complex State Definitions: Using TypedDict for structured state representation.
2. State Modification: Functions to update state in a controlled manner.
3. Graph Creation: Constructing simple and complex StateGraph objects.
4. Message Handling: Incorporating HumanMessage and AIMessage in state.
5. Graph Compilation and Invocation: Demonstrating how to compile and run graphs.
The script progresses through increasingly complex examples, from basic state manipulation
to creating and running graphs with state. It serves as both a learning tool and a
reference for implementing stateful workflows in LangGraph.
Usage:
Run this script to step through an interactive session that illustrates each concept
with practical examples and output.
Dependencies:
- langgraph
- langchain_core
Author: @gitmaxd
Date: 2024-08-15
Version: 1.0
"""

from typing import TypedDict, Annotated
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langchain_core.messages import HumanMessage, AIMessage

# Step 1: Basic State Definition
class BasicState(TypedDict):
    count: int

# Step 2: More Complex State
class ComplexState(TypedDict):
    count: int
    messages: Annotated[list[HumanMessage | AIMessage], add_messages]

# Step 3: State Modification Functions
def increment_count(state: BasicState) -> BasicState:
    return BasicState(count=state["count"] + 1)

def add_message(state: ComplexState, message: str, is_human: bool = True) -> ComplexState:
    new_message = HumanMessage(content=message) if is_human else AIMessage(content=message)
    return ComplexState(
        count=state["count"],
        messages=state["messages"] + [new_message]
    )

# Step 4: Simple Graph with State
def create_simple_graph():
    workflow = StateGraph(BasicState)
    
    def increment_node(state: BasicState):
        return {"count": state["count"] + 1}
    
    workflow.add_node("increment", increment_node)
    workflow.set_entry_point("increment")
    workflow.add_edge("increment", END)
    
    return workflow.compile()

# Step 5: More Complex Graph with State
def create_complex_graph():
    workflow = StateGraph(ComplexState)
    
    def process_message(state: ComplexState):
        last_message = state["messages"][-1].content if state["messages"] else "No messages yet"
        response = f"Received: {last_message}. Count is now {state['count'] + 1}"
        return {
            "count": state["count"] + 1,
            "messages": state["messages"] + [AIMessage(content=response)]
        }
    
    workflow.add_node("process", process_message)
    workflow.set_entry_point("process")
    workflow.add_edge("process", END)
    
    return workflow.compile()

# Interactive Session
def run_interactive_session():
    print("Welcome to the Interactive LangGraph State Lesson!")
    
    print("\nStep 1: Basic State")
    basic_state = BasicState(count=0)
    print(f"Initial basic state: {basic_state}")
    
    print("\nStep 2: More Complex State")
    complex_state = ComplexState(count=0, messages=[])
    print(f"Initial complex state: {complex_state}")
    
    print("\nStep 3: State Modification")
    modified_basic = increment_count(basic_state)
    print(f"Modified basic state: {modified_basic}")
    
    modified_complex = add_message(complex_state, "Hello, LangGraph!")
    print(f"Modified complex state: {modified_complex}")
    
    print("\nStep 4: Simple Graph with State")
    simple_graph = create_simple_graph()
    result = simple_graph.invoke(BasicState(count=0))
    print(f"Simple graph result: {result}")
    
    print("\nStep 5: Complex Graph with State")
    complex_graph = create_complex_graph()
    initial_state = ComplexState(count=0, messages=[HumanMessage(content="Hello, LangGraph!")])
    result = complex_graph.invoke(initial_state)
    print(f"Complex graph result: {result}")

if __name__ == "__main__":
    run_interactive_session()
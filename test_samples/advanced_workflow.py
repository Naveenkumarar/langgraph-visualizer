"""
Advanced LangGraph Workflow Example
Demonstrates multiple patterns: tools, agents, conditional routing, and structured outputs
"""

from typing import TypedDict, Literal
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, START, END
from langgraph.prebuilt import ToolNode


# ============= Tool Definitions =============


@tool
def search_database(query: str) -> str:
    """Search the internal database for relevant information."""
    return f"Database results for: {query}"


@tool
def web_search(query: str) -> str:
    """Search the web for current information."""
    return f"Web search results for: {query}"


@tool
def calculator(expression: str) -> str:
    """Perform mathematical calculations."""
    try:
        result = eval(expression)
        return f"Result: {result}"
    except Exception as e:
        return f"Error: {str(e)}"


@tool
def send_email(recipient: str, subject: str, body: str) -> str:
    """Send an email to a recipient."""
    return f"Email sent to {recipient} with subject: {subject}"


# ============= State Definition =============


class WorkflowState(TypedDict):
    """State for the workflow."""

    messages: list
    query: str
    search_type: str
    needs_calculation: bool
    result: str
    confidence: float


# ============= LLM Setup =============

llm = ChatOpenAI(model="gpt-4", temperature=0)


# ============= Node Functions =============


def analyze_query(state: WorkflowState) -> WorkflowState:
    """Analyze the incoming query to determine processing strategy."""
    query = state["query"]

    # Use LLM with structured output to classify the query
    classifier = llm.bind_tools([search_database, web_search, calculator])

    messages = [
        SystemMessage(content="Analyze the query and determine the best approach."),
        HumanMessage(content=query),
    ]

    response = classifier.invoke(messages)

    # Update state based on analysis
    state["messages"] = messages + [response]
    state["needs_calculation"] = (
        "calculate" in query.lower() or "compute" in query.lower()
    )

    return state


def route_query(
    state: WorkflowState,
) -> Literal["search_internal", "search_web", "calculate"]:
    """Route the query to the appropriate search or calculation node."""
    query = state["query"].lower()

    if state.get("needs_calculation", False):
        return "calculate"
    elif "current" in query or "latest" in query or "news" in query:
        return "search_web"
    else:
        return "search_internal"


def search_internal(state: WorkflowState) -> WorkflowState:
    """Search internal database using the search tool."""
    query = state["query"]
    result = search_database.invoke({"query": query})
    state["result"] = result
    state["search_type"] = "internal"
    state["confidence"] = 0.9
    return state


def search_web_node(state: WorkflowState) -> WorkflowState:
    """Search the web using the web search tool."""
    query = state["query"]
    result = web_search.invoke({"query": query})
    state["result"] = result
    state["search_type"] = "web"
    state["confidence"] = 0.7
    return state


def calculate_node(state: WorkflowState) -> WorkflowState:
    """Perform calculations using the calculator tool."""
    # Extract mathematical expression from query
    expression = state["query"].split("calculate")[-1].strip()
    result = calculator.invoke({"expression": expression})
    state["result"] = result
    state["search_type"] = "calculation"
    state["confidence"] = 1.0
    return state


def evaluate_result(state: WorkflowState) -> WorkflowState:
    """Evaluate the quality of the result."""
    # Use structured output for evaluation
    from pydantic import BaseModel, Field

    class ResultEvaluation(BaseModel):
        is_sufficient: bool = Field(description="Whether the result is sufficient")
        needs_refinement: bool = Field(description="Whether refinement is needed")
        quality_score: float = Field(description="Quality score from 0 to 1")

    evaluator = llm.with_structured_output(ResultEvaluation)

    eval_prompt = f"""
    Evaluate this result:
    Query: {state['query']}
    Result: {state['result']}
    Search Type: {state['search_type']}
    """

    evaluation = evaluator.invoke([HumanMessage(content=eval_prompt)])

    state["confidence"] = evaluation.quality_score

    return state


def should_refine(
    state: WorkflowState,
) -> Literal["refine_search", "generate_response"]:
    """Decide whether to refine the search or generate final response."""
    confidence = state.get("confidence", 0.5)

    if confidence < 0.6:
        return "refine_search"
    else:
        return "generate_response"


def refine_search(state: WorkflowState) -> WorkflowState:
    """Refine the search with additional context."""
    # Use agent with multiple tools for refinement
    agent_llm = llm.bind_tools([search_database, web_search, calculator])

    refinement_prompt = f"""
    The initial search didn't yield sufficient results.
    Original query: {state['query']}
    Previous result: {state['result']}
    Please perform a more thorough search.
    """

    response = agent_llm.invoke([HumanMessage(content=refinement_prompt)])
    state["result"] = str(response.content)
    state["confidence"] = 0.8

    return state


def generate_response(state: WorkflowState) -> WorkflowState:
    """Generate the final response to the user."""
    synthesis_prompt = f"""
    Create a comprehensive response based on:
    Query: {state['query']}
    Search Result: {state['result']}
    Search Type: {state['search_type']}
    Confidence: {state['confidence']}
    """

    final_response = llm.invoke([HumanMessage(content=synthesis_prompt)])
    state["messages"].append(final_response)

    return state


def should_notify(state: WorkflowState) -> Literal["send_notification", "end"]:
    """Decide whether to send a notification."""
    # Send notification for high-value queries
    if state.get("confidence", 0) > 0.85 and "urgent" in state["query"].lower():
        return "send_notification"
    else:
        return "end"


def send_notification(state: WorkflowState) -> WorkflowState:
    """Send email notification for important queries."""
    send_email.invoke(
        {
            "recipient": "user@example.com",
            "subject": "Query Results",
            "body": f"Results for: {state['query']}\n\n{state['result']}",
        }
    )

    return state


# ============= Graph Construction =============

# Create the workflow graph
workflow = StateGraph(WorkflowState)

# Add all nodes
workflow.add_node("analyze_queries", analyze_query)
workflow.add_node("search_internal", search_internal)
workflow.add_node("search_web", search_web_node)
workflow.add_node("calculate", calculate_node)
workflow.add_node("evaluate_result", evaluate_result)
workflow.add_node("refine_search", refine_search)
workflow.add_node("generate_response", generate_response)
workflow.add_node("send_notification", send_notification)

# Add edges
workflow.add_edge(START, "analyze_queries")

# Conditional routing from analyze_query
workflow.add_conditional_edges(
    "analyze_queries",
    route_query,
    {
        "search_internal": "search_internal",
        "search_web": "search_web",
        "calculate": "calculate",
    },
)

# All search/calculate nodes go to evaluate_result
workflow.add_edge("search_internal", "evaluate_result")
workflow.add_edge("search_web", "evaluate_result")
workflow.add_edge("calculate", "evaluate_result")

# Conditional routing after evaluation
workflow.add_conditional_edges(
    "evaluate_result",
    should_refine,
    {
        "refine_search": "refine_search",
        "generate_response": "generate_response",
    },
)

# Refine goes back to evaluation
workflow.add_edge("refine_search", "evaluate_result")

# Generate response then check for notification
workflow.add_conditional_edges(
    "generate_response",
    should_notify,
    {
        "send_notification": "send_notification",
        "end": END,  # Map "end" string to END constant
    },
)

# Final edges
workflow.add_edge("send_notification", END)

# Compile the graph
app = workflow.compile()


# ============= Example Usage =============

if __name__ == "__main__":
    # Test with different query types
    test_queries = [
        {
            "query": "What are the latest AI developments?",
            "messages": [],
            "search_type": "",
            "needs_calculation": False,
            "result": "",
            "confidence": 0.0,
        },
        {
            "query": "Find internal data about project X",
            "messages": [],
            "search_type": "",
            "needs_calculation": False,
            "result": "",
            "confidence": 0.0,
        },
        {
            "query": "Calculate 15 * 7 + 32",
            "messages": [],
            "search_type": "",
            "needs_calculation": True,
            "result": "",
            "confidence": 0.0,
        },
    ]

    for test_input in test_queries:
        print(f"\n{'='*60}")
        print(f"Query: {test_input['query']}")
        print(f"{'='*60}")

        # Run the workflow
        # result = app.invoke(test_input)
        # print(f"Result: {result['result']}")
        # print(f"Confidence: {result['confidence']}")

"""
LangGraph Debug Example - A simple chatbot workflow
Run this file to test the LangGraph Visualizer debugging features
"""

from langgraph.graph import StateGraph, END
from typing import TypedDict, Literal
import time


class ChatState(TypedDict):
    """State for the chatbot"""
    user_input: str
    response: str
    sentiment: str
    step_count: int


def receive_input(state: ChatState) -> ChatState:
    """Receive and log user input"""
    print(f"📥 Received input: {state['user_input']}")
    print("   ⏳ Processing for 5 seconds...")
    time.sleep(5)  # 5 second delay to see node highlighting
    return {
        **state,
        "step_count": state.get("step_count", 0) + 1
    }


def analyze_sentiment(state: ChatState) -> ChatState:
    """Analyze the sentiment of user input"""
    user_input = state["user_input"].lower()
    
    # Simple sentiment analysis
    positive_words = ["good", "great", "happy", "love", "excellent", "awesome", "thanks"]
    negative_words = ["bad", "sad", "angry", "hate", "terrible", "awful", "sorry"]
    
    sentiment = "neutral"
    for word in positive_words:
        if word in user_input:
            sentiment = "positive"
            break
    for word in negative_words:
        if word in user_input:
            sentiment = "negative"
            break
    
    print(f"🔍 Detected sentiment: {sentiment}")
    print("   ⏳ Processing for 5 seconds...")
    time.sleep(5)  # 5 second delay to see node highlighting
    return {
        **state,
        "sentiment": sentiment,
        "step_count": state.get("step_count", 0) + 1
    }


def route_by_sentiment(state: ChatState) -> Literal["positive_response", "negative_response", "neutral_response"]:
    """Route to different response generators based on sentiment"""
    sentiment = state.get("sentiment", "neutral")
    print(f"🔀 Routing based on sentiment: {sentiment}")
    
    if sentiment == "positive":
        return "positive_response"
    elif sentiment == "negative":
        return "negative_response"
    else:
        return "neutral_response"


def generate_positive_response(state: ChatState) -> ChatState:
    """Generate a positive response"""
    print("😊 Generating positive response...")
    print("   ⏳ Processing for 5 seconds...")
    time.sleep(5)  # 5 second delay to see node highlighting
    return {
        **state,
        "response": f"That's wonderful to hear! I'm glad you're feeling good. How can I help you today?",
        "step_count": state.get("step_count", 0) + 1
    }


def generate_negative_response(state: ChatState) -> ChatState:
    """Generate an empathetic response"""
    print("😢 Generating empathetic response...")
    print("   ⏳ Processing for 5 seconds...")
    time.sleep(5)  # 5 second delay to see node highlighting
    return {
        **state,
        "response": f"I'm sorry to hear that. Is there anything I can do to help make things better?",
        "step_count": state.get("step_count", 0) + 1
    }


def generate_neutral_response(state: ChatState) -> ChatState:
    """Generate a neutral response"""
    print("😐 Generating neutral response...")
    print("   ⏳ Processing for 5 seconds...")
    time.sleep(5)  # 5 second delay to see node highlighting
    return {
        **state,
        "response": f"I understand. How can I assist you today?",
        "step_count": state.get("step_count", 0) + 1
    }


def finalize_response(state: ChatState) -> ChatState:
    """Finalize and format the response"""
    print(f"✅ Finalizing response...")
    print("   ⏳ Processing for 5 seconds...")
    time.sleep(5)  # 5 second delay to see node highlighting
    return {
        **state,
        "step_count": state.get("step_count", 0) + 1
    }


# Build the graph
workflow = StateGraph(ChatState)

# Add nodes
workflow.add_node("receive_input", receive_input)
workflow.add_node("analyze_sentiment", analyze_sentiment)
workflow.add_node("positive_response", generate_positive_response)
workflow.add_node("negative_response", generate_negative_response)
workflow.add_node("neutral_response", generate_neutral_response)
workflow.add_node("finalize", finalize_response)

# Add edges
workflow.set_entry_point("receive_input")
workflow.add_edge("receive_input", "analyze_sentiment")

# Conditional routing based on sentiment
workflow.add_conditional_edges(
    "analyze_sentiment",
    route_by_sentiment,
    {
        "positive_response": "positive_response",
        "negative_response": "negative_response",
        "neutral_response": "neutral_response"
    }
)

# All response types lead to finalize
workflow.add_edge("positive_response", "finalize")
workflow.add_edge("negative_response", "finalize")
workflow.add_edge("neutral_response", "finalize")
workflow.add_edge("finalize", END)

# Compile the graph
app = workflow.compile()


# # Run the example when executed directly
if __name__ == "__main__":
    print("\n" + "="*50)
    print("🤖 Chatbot Workflow Demo")
    print("="*50)
    print("Each node has a 5 second delay to see highlighting")
    print("="*50 + "\n")
    
    # Test with one input to demonstrate node highlighting
    user_input = "I'm having a great day today!"
    
    print(f"Test: \"{user_input}\"")
    print('─'*40)
    
    initial_state = {
        "user_input": user_input,
        "response": "",
        "sentiment": "",
        "step_count": 0
    }
    
    result = app.invoke(initial_state)
    
    print(f"\n📤 Response: {result['response']}")
    print(f"📊 Final sentiment: {result['sentiment']}")
    print(f"📈 Steps taken: {result['step_count']}")
    
    print("\n" + "="*50)
    print("✨ Demo complete!")
    print("="*50 + "\n")


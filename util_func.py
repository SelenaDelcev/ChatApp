# These functions will handle the initialization of your classes and can be reused across different endpoints.
import json
from myfunc.retrievers import HybridQueryProcessor
from myfunc.mssql import work_prompts
from openai import OpenAI

mprompts = work_prompts()

def get_openai_client():
    return OpenAI()

def get_hybrid_query_processor():
    return HybridQueryProcessor()

def positive_calendly():
    calendly_url = "https://outlook.office365.com/book/Chatbot@positive.rs/"
    return calendly_url

def get_structured_decision_from_model(user_query):
    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o",
        temperature=0,
        response_format={"type": "json_object"},
        messages=[
        {"role": "system", "content": mprompts["choose_rag"]},
        {"role": "user", "content": f"Please provide the response in JSON format: {user_query}"}
    ],
    )
    json_string = response.choices[0].message.content
    # Parse the JSON string into a Python dictionary
    data_dict = json.loads(json_string)
    # Access the 'tool' value
    return data_dict['tool'] if 'tool' in data_dict else list(data_dict.values())[0]

def rag_tool_answer(prompt):
    context = ""
    rag_tool = get_structured_decision_from_model(prompt)

    if  rag_tool == "Hybrid":
        processor = HybridQueryProcessor(namespace="embedding-za-sajt")
        context, _ = processor.process_query_results(prompt)
        
    elif rag_tool == "Calendly":
        # Schedule Calendly meeting
        context = positive_calendly()

    return context

system_prompt = mprompts["sys_ragbot"]
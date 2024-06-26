from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
import logging
from typing import Dict, List
from starlette.responses import StreamingResponse
import re

# Initialize the FastAPI app
app = FastAPI()

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://nice-forest-0cdf73d0f.5.azurestaticapps.net"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data model for incoming messages
class Message(BaseModel):
    role: str
    content: str

messages: Dict[str, List[Dict[str, str]]] = {}

system_prompt = (
    # [Your system prompt here]
)

@app.post('/chat')
async def chat_with_ai(request: Request, message: Message):
    session_id = request.headers.get("Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID not provided")

    if session_id not in messages:
       messages[session_id] = [{"role": "system", "content": system_prompt}]
    try:
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        logger.info(f"Received message: {message.content}")

        messages[session_id].append({"role": "user", "content": message.content})

        logger.info(f"Messages: {messages[session_id]}")

        openai_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages[session_id]]

        # The prepared messages
        logger.info(f"Prepared OpenAI messages: {openai_messages}")

        response = client.chat.completions.create(
            model="gpt-4",
            temperature=0.0,
            messages=openai_messages,
            stream=True
        )

        logger.info(f"OpenAI response: {response}")

        def event_generator():
            full_response = ""
            assistant_message_content = ""
            for res in response:
                try:
                    chunk = res.choices[0].delta.content
                    full_response += chunk
                    # Replace Markdown bold with HTML bold
                    assistant_message_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', full_response)
                    # Replace Markdown links with HTML links
                    assistant_message_content = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', assistant_message_content)
                    yield f"data: {assistant_message_content + '▌'}\n\n"
                except Exception as e:
                    logger.error(f"Error processing chunk: {str(e)}")
                    yield f"data: {full_response}\n\n"
            yield f"data: {assistant_message_content}\n\n"

        return StreamingResponse(event_generator(), media_type="text/event-stream")
    
    except openai.OpenAIError as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")
    except Exception as e:
        logger.error(f"Internal server error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@app.get('/chat/stream')
async def chat_stream(session_id: str):
    if session_id not in messages:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    def event_generator():
        while True:
            if len(messages[session_id]) > 0:
                message = messages[session_id].pop(0)
                yield f"data: {message['content']}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

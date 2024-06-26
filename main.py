from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
import logging
from typing import Dict, List

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

@app.post('/chat')
async def chat_with_ai(request: Request, message: Message):
    session_id = request.headers.get("Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID not provided")

    if session_id not in messages:
        messages[session_id] = [{"role": "system", "content": "You are a helpful assistant that always writes in Serbian."}]
    try:
        client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

        logger.info(f"Received message: {message.content}")

        messages[session_id].append({"role": "user", "content": message.content})

        logger.info(f"Messages: {messages[session_id]}")

        openai_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages[session_id]]

        # The prepared messages
        logger.info(f"Prepared OpenAI messages: {openai_messages}")

        response = client.chat.completions.create(
            model="gpt-4o",
            temperature=0.0,
            messages=openai_messages,
        )

        logger.info(f"OpenAI response: {response}")

        # Extract the assistant's message content
        if response.choices:
            assistant_message_content = response.choices[0].message.content
            messages[session_id].append({"role": "assistant", "content": assistant_message_content})
            logger.info(f"Assistant response: {assistant_message_content}")
        else:
            raise ValueError("Unexpected response format: 'choices' list is empty")

        return {"messages": messages[session_id]}
    except openai.OpenAIError as e:
        logger.error(f"OpenAI API error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"OpenAI API error: {str(e)}")
    except Exception as e:
        logger.error(f"Internal server error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

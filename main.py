from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import openai
import logging
import re
from typing import Dict, List, Optional
from openai import OpenAI, RateLimitError, APIConnectionError, APIError
from util_func import get_openai_client, rag_tool_answer, system_prompt
import PyPDF2
import docx
import json
import asyncio
import base64

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


# NOVO >> da zajedno sa porukom pošaljemo i info da li treba da generisemo predložena pitanja
class ChatRequest(BaseModel):
    message: Message
    suggest_questions: Optional[bool] = False

# NOVO >> obican openai poziv
def generate_suggested_questions(sq_system, sq_user): 
    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[sq_system, sq_user],
    )
    odgovor = response.choices[0].message.content
    # Filter out empty strings
    return [question for question in odgovor.split('\n') if question.strip()]



def initialize_session(request, messages: Dict[str, List[Dict[str, str]]], system_prompt):
    session_id = request.headers.get("Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID not provided")
    if session_id not in messages:
        messages[session_id] = [{"role": "system", "content": system_prompt()}]
    return session_id
def read_pdf(file):
    reader = PyPDF2.PdfReader(file)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    return text
def read_docx(file):
    doc = docx.Document(file)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text


# NOVO >> chat_request paket umesto samo message
@app.post('/chat')
async def chat_with_ai(
    request: Request,
    chat_request: ChatRequest,
):
    message = chat_request.message
    suggest_questions = chat_request.suggest_questions

    session_id = initialize_session(request, messages, system_prompt)
    logger.info(f"Received message: {message.content}")
    context = rag_tool_answer(message.content)
    logger.info(f"Context from RAG: {context}")
    if context == "https://outlook.office365.com/book/Chatbot@positive.rs/":
        return {"calendly_url": context}
        
    prepared_message_content = f"{context}\n\n{message.content}"
        
    # Save the original user message
    messages[session_id].append({"role": "user", "content": message.content})
    logger.info(f"Messages: {messages[session_id]}")
    # Add the prepared message content with context to the OpenAI messages
    ({"role": "user", "content": prepared_message_content})

    response_data = {"detail": "Message received"}
    if suggest_questions:
        sq_system = {
            "role": "system",
            "content": f"Use only the Serbian language"
        }
        sq_user = {
            "role": "user",
            "content": f"""You are an AI language model assistant for a company's chatbot. Your task is to generate 3 different possible continuation sentences that a user might say based on the given context. These continuations should be in the form of questions or statements that naturally follow from the conversation.

                        Your goal is to help guide the user through the Q&A process by predicting their next possible inputs. Ensure these continuations are from the user's perspective and relevant to the context provided.

                        Provide these sentences separated by newlines, without numbering.

                        Original context:
                        {message.content}
                        """}
        suggested_questions = generate_suggested_questions(sq_system, sq_user)
        response_data["suggested_questions"] = suggested_questions

    return response_data


@app.get('/chat/stream')
async def stream(session_id: str):
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID not provided")
    if session_id not in messages:
        raise HTTPException(status_code=400, detail="No messages found for session")
    
    client = get_openai_client()
    openai_messages = [{"role": msg["role"], "content": msg["content"]} for msg in messages[session_id]]
    async def event_generator():
        try:
            assistant_message_content = ""
            for response in client.chat.completions.create(
                model="gpt-4o",
                temperature=0.0,
                messages=openai_messages,
                stream=True,
            ):
                content = response.choices[0].delta.content or ""
                if content:
                    assistant_message_content += content
                    # Text formatting
                    formatted_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', assistant_message_content)
                    formatted_content = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2" target="_blank">\1</a>', formatted_content)
                    # Adding a typing character
                    streaming_content = formatted_content + '▌'
                    logger.info(f"Streaming content: {streaming_content}")
                    json_data = json.dumps({'content': streaming_content})
                    yield f"data: {json_data}\n\n"
                    await asyncio.sleep(0.1)
            final_formatted_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', assistant_message_content)
            final_formatted_content = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2" target="_blank">\1</a>', final_formatted_content)
            logger.info(f"Assistant response: {final_formatted_content}")
            final_json_data = json.dumps({'content': final_formatted_content})
            yield f"data: {final_json_data}\n\n"
            messages[session_id].append({"role": "assistant", "content": final_formatted_content})
        except RateLimitError as e:
            if 'insufficient_quota' in str(e):
                logger.error("Potrošili ste sve tokene, kontaktirajte Positive za dalja uputstva")
                yield f"data: {json.dumps({'detail': 'Potrošili ste sve tokene, kontaktirajte Positive za dalja uputstva'})}\n\n"
            else:
                logger.error(f"Rate limit error: {str(e)}")
                yield f"data: {json.dumps({'detail': f'Rate limit error: {str(e)}'})}\n\n"
        except APIConnectionError as e:
            logger.error(f"Ne mogu da se povežem sa OpenAI API-jem: {e}")
            yield f"data: {json.dumps({'detail': f'Ne mogu da se povežem sa OpenAI API-jem: {e} pokušajte malo kasnije.'})}\n\n"
        except APIError as e:
            logger.error(f"Greška u API-ju: {e}")
            yield f"data: {json.dumps({'detail': f'Greška u API-ju: {e} pokušajte malo kasnije.'})}\n\n"
        except openai.OpenAIError as e:
            logger.error(f"OpenAI API error: {str(e)}")
            yield f"data: {json.dumps({'detail': f'OpenAI API error: {str(e)}'})}\n\n"
        except Exception as e:
            logger.error(f"Internal server error: {str(e)}")
            yield f"data: {json.dumps({'detail': f'Internal server error: {str(e)}'})}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")

async def process_image(image_content: bytes, mime_type: str):
    # Encode the image content to base64
    image_base64 = base64.b64encode(image_content).decode('utf-8')
    data_url_prefix = f"data:{mime_type};base64,{image_base64}"
    client = get_openai_client()
    # Create a request to OpenAI to describe the image
    response = client.chat.completions.create(
        model='gpt-4o',
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Opiši šta se nalazi na slici?"},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": data_url_prefix
                        }
                    }
                ]
            }
        ],
        max_tokens=300,
    )

    # Extract the description from the response
    description = response.choices[0].message.content
    return description

@app.post('/upload')
async def upload_file(
    request: Request,
    message: str = Form(...),
    files: List[UploadFile] = File(...),
):
    session_id = initialize_session(request, messages, system_prompt)
    try:
        all_text_content = ""
        for file in files:
            file_content = await file.read()
            # Logovanje posle čitanja fajla
            logger.info(f"File content after read: {len(file_content)} bytes")
            text_content = ""
            if file.content_type == 'application/pdf':
                text_content = read_pdf(file.file)
            elif file.content_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                text_content = read_docx(file.file)
            elif file.content_type == 'text/plain':
                text_content = file_content.decode('utf-8')
            elif file.content_type in ['image/jpeg', 'image/png', 'image/webp']:
                text_content = await process_image(file_content, file.content_type)
            else:
                return {"detail": "Nije podržan ovaj tip datoteke"}

            all_text_content += text_content + "\n"

        messages[session_id].append({"role": "user", "content": message})
        logger.info(f"Messages: {messages[session_id]}")

        prepared_message_content = f"User message: {message}\nFile content:\n{all_text_content}"
        
        messages[session_id].append({"role": "user", "content": prepared_message_content})

    except Exception as e:
        logger.error(f"File upload error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"File upload error: {str(e)}")
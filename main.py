from fastapi import FastAPI, HTTPException, Request, File, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, List, Optional
from openai import OpenAI, OpenAIError, RateLimitError, APIConnectionError, APIError
from util_func import get_openai_client, rag_tool_answer, system_prompt
import openai
import logging
import re
import io
import os
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

class ChatRequest(BaseModel):
    message: Message
    suggest_questions: Optional[bool] = False
    play_audio_response: Optional[bool] = False
    language: Optional[str] = "sr"

# Function for generating suggested questions.
def generate_suggested_questions(sq_system, sq_user): 
    client = get_openai_client()
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[sq_system, sq_user],
    )
    questionsList = response.choices[0].message.content
    # Filter out empty strings
    return [question for question in questionsList.split('\n') if question.strip()]

# Function for generating an audio response.
def generate_audio_response(full_response):
    client = get_openai_client()
    spoken_response = client.audio.speech.create(
        model="tts-1-hd",
        voice="nova",
        input=full_response,
    )
    spoken_response_bytes = spoken_response.read()
    buffer = io.BytesIO(spoken_response_bytes)
    buffer.seek(0)
    audio_base64 = base64.b64encode(buffer.read()).decode()
    return audio_base64

# Function for initializing user session.
def initialize_session(request, messages: Dict[str, List[Dict[str, str]]], system_prompt):
    session_id = request.headers.get("Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID not provided")
    if session_id not in messages:
        messages[session_id] = [{"role": "system", "content": system_prompt}]
    return session_id

# Function for reading .pdf files after upload.
def read_pdf(file):
    reader = PyPDF2.PdfReader(file)
    text = ""
    for page in reader.pages:
        text += page.extract_text()
    return text

# Function for reading .docx files after upload.
def read_docx(file):
    doc = docx.Document(file)
    text = ""
    for paragraph in doc.paragraphs:
        text += paragraph.text + "\n"
    return text

# The endpoint is called from the frontend when the user sends a message. The message is accepted, prepared in this endpoint, and then stored in the messages variable.
@app.post('/chat')
async def chat_with_ai(
    request: Request,
    chat_request: ChatRequest,
):
    message = chat_request.message
    suggest_questions = chat_request.suggest_questions
    language = chat_request.language

    print(f"Language: {language}")

    session_id = initialize_session(request, messages, system_prompt)

    if session_id not in messages:
        messages[session_id] = [{"role": "system", "content": system_prompt}]
    messages[session_id].append({"role": "system", "content": f"Use only the {'English' if language == 'en' else 'Serbian'} language. {system_prompt}"})

    # Use RAG tool for context
    context = rag_tool_answer(message.content)

    # If the response from the RAG tool is a meeting link, return calendly_url
    if context == "https://outlook.office365.com/book/Chatbot@positive.rs/":
        return {"calendly_url": context}
        
    prepared_message_content = f"{context}\n\n{message.content}"
        
    # Save the original user message
    messages[session_id].append({"role": "user", "content": message.content})

    # Add the prepared message content with context to the OpenAI messages
    ({"role": "user", "content": prepared_message_content})

    response_data = {"detail": "Message received"}
    
    if suggest_questions:
        sq_system = {
            "role": "system",
            "content": f"Use only the {'English' if language == 'en' else 'Serbian'} language"
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

# Endpoint used to send OpenAI messages and generate streamed messages.
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

            # Remove tags to generate text for audio response
            plain_text_content = re.sub(r'<.*?>', '', final_formatted_content)
            
            audio_response = generate_audio_response(plain_text_content)

            final_json_data = json.dumps({'content': final_formatted_content, 'audio': audio_response})
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
        except Exception as e:
            logger.error(f"Internal server error: {str(e)}")
            yield f"data: {json.dumps({'detail': f'Internal server error: {str(e)}'})}\n\n"
            
    return StreamingResponse(event_generator(), media_type="text/event-stream")

# Generate a text description for the image.
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

# The function is called when checking what type of file is uploaded and sends file/s to a specific function.
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

# The function is called when a voice message is recorded, the text is transcribed, and returned to the front end.   
@app.post("/transcribe")
async def transcribe_audio(file: UploadFile = File(...), session_id: str = Form(...)):
    try:
        client = get_openai_client()
        file_location = f"temp_{session_id}.mp4"
        with open(file_location, "wb") as f:
            f.write(await file.read())

        with open(file_location, "rb") as audio_file:
            response = client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                language="sr"
            )

        os.remove(file_location)

        return {"transcript": response.text}
    except OpenAIError as e:
        print(f"OpenAI Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
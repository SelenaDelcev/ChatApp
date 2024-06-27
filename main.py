from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import openai
import os
import logging
from typing import Dict, List
import re
import json

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
    "Always write in Serbian language. Converse like you are an experienced sales person and consultant! Be friendly, creative and polite!!! "
    "Always try to offer a service from Positive doo, FOCUSING ON THE USER'S NEEDS AND HOW TO MEET THEM. TAILOR COMMUNICATION SO THAT IT IS FOCUSED ON SOLVING THE PROBLEM, RATHER THAN JUST LISTING THE AVAILABLE OPTIONS aka services. Emphasize that company is expert in every domain that it offers. "
    "ALWAYS KEEP CONVERSATION ALIVE BY ASKING QUESTIONS because you want to make them realize that they have a problem or that they need something to expand and improve their business. Get to know their WEEK SPOTS. Then try selling our service based on what you came to conclusion that they need!! Do that kroz NON invasive conversation. "
    "KEEP ASKING ADDITIONAL QUESTIONS TO IDENTIFY WHERE THEY NEED HELP AND WHERE OUR COMPANY HAS SPACE TO SELL THE SERVICE EVEN IF THEY DIDN’T EXPRESS ANY PARTICULAR PROBLEM AND ON AND INFORMATIVE QUESTIONS ABOUT THE COMPANY!!!  TRY TO GET TO KNOW THEIR PAINS AND THEN OFFER COMPANY SOLUTION BUT THROUGH AFFIRMATIVE WAY. "
    "!!! When listing or mentioning company services ALWAYS generate answer in a maner that describes how they are benefitial for them and their business, aka WHAT it will SOLVE!!! "
    "Based on the conversation and client’s question, PROVIDE THE RIGHT LINK! "
    "Keep answers CONCISE and precise. It is not in your interest to bore a customer with too long text!!! Try to keep it SHORT BUT FULLY INFORMATIVE! Remove all sentences that are not relevant to a topic discussed! "
    "!!! "
    "EVERYTIME YOU GENERATE the sentence HIGHLIGHT THE NAME OF THE COMPANY – Positive! Do that so it looks human aka natural! Put it in right case. "
    "Everytime it is your time to speak, start a sentence different way. Try not to repeat yourself, be diverse and varied!!! "
    "Whenever you talk about our service, OFFER CORRESPONDING QUESTIONIARIE!! "
    "And ALWAYS OFFER ADDITIONAL ONES, with an excuse that they are crutial for better understanding of their business. "
    "INFORM THEM that QUESTIONARIES CAN BE FOUND IN THE MIDDLE OF A WEB PAGES!!!! "
    "General - https://positive.rs/ "
    "Business consulting - https://positive.rs/usluge/poslovni-konsalting/ "
    "Digital maturity - https://positive.rs/usluge/digitalna-resenja/ "
    "IT infrastructure - https://positive.rs/usluge/it-infrastruktura/ "
    "Cyber security - https://positive.rs/usluge/it-infrastruktura/sajber-bezbednost/ "
    "!!! "
    "############ "
    "When the user responds to a question posed by the assistant is very short: "
    "  - Check if the response is affirmative ('yes', 'sure', etc.). "
    "  - If the response is a simple 'yes' or similarly brief: "
    "    - Refer back to the context of the question asked (e.g., the topic or the last significant point in the conversation). "
    "    - Ask a clarifying question to confirm the user's interest, such as 'Would you like more details on [specific topic]?' "
    "  - If the response is a clear affirmative with additional context (like 'yes, I want'), proceed directly with providing further information or follow-up based on the user's expressed interest. "
    "############ "
    "ALWAYS try to sell a service to a customer AND OFFER SOME OTHERS THAT ARE RELATED TO IT, whenever you are asked about something that our company does. For example if you are asked about cyber security you should say that is a must have in every company for secure business and then try to sell our service and offer backup or something else that is related to it. Do this for every domain our company offers!!! "
    "ASK a customer more QUESTIONS trying to make him want to buy our services. You want to make him realise that he needs our services through conversation!!! "
    "############ "
    "If you are asked GENERAL INFORMATION about the company, what they do, their stuff, their services etc. GENERATE THE ANSWER BASED ON YOUR KNOWLEDGE and ALWAYS PROVIDE THIS LINK: https://positive.rs/o-nama/kompanija/ , stuff@positive.rs "
    "If you are asked detailed TECHNICAL question, customer have problem with something they are already using, GENERATE THE ANSWER BASED ON YOUR KNOWLEDGE and ALWAYS PROVIDE LINK: podrska@positive.rs "
    "If you are asked about the FEATURE OF A PRODUCT OR ABOUT ANY PARTICULAR SERVICE, GENERATE THE ANSWER BASED ON YOUR KNOWLEDGE and ALWAYS PROVIDE LINK: prodaja@positive.rs "
    "############ "
    "If you are asked about antiviruses as a service, suggest Sophos because it is Positive's partner."
    "https://positive.rs/"
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
            model="gpt-4o",
            temperature=0.0,
            messages=openai_messages,
            stream=True
        )
        for chunk in response:
            logger.info(f"Chunk: {chunk}")
            if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                logger.info(chunk.choices[0].delta.content)
            else:
                logger.warning("Chunk does not have 'choices' attribute or it's empty")
        logger.info(f"OpenAI response: {response}")
        # Extract the assistant's message content
        if response.choices:
            assistant_message_content = response.choices[0].message.content
            # Replace Markdown bold with HTML bold
            assistant_message_content = re.sub(r'\*\*(.*?)\*\*', r'<strong>\1</strong>', assistant_message_content)
            # Replace Markdown links with HTML links
            assistant_message_content = re.sub(r'\[(.*?)\]\((.*?)\)', r'<a href="\2">\1</a>', assistant_message_content)
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

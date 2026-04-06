from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    styles: List[str]
    moods: List[str]
    platform: str = "Universal"
    subject: Optional[str] = None
    complexity: str

@app.get("/")
def home():
    return {"status": "ok"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/generate")
def generate_prompt(req: GenerateRequest):
    if req.complexity == "SIMPLE":
        system_prompt = "You are an expert AI prompt creator. Generate a 1-sentence, beginner-friendly art prompt based on the user's input. Output ONLY the prompt, no labels or preamble."
    elif req.complexity == "DETAILED":
        system_prompt = "You are an expert AI prompt creator. Generate a 3-4 sentence detailed art prompt including lighting, mood, and composition based on the user's input. Output ONLY the prompt, no labels or preamble."
    else:  # ULTRA-DETAILED
        system_prompt = "You are an expert AI prompt creator. Generate a 5-6 sentence ultra-detailed art prompt including camera specifics, palette, references, and tags based on the user's input. Output ONLY the prompt, no labels or preamble."

    user_content = f"Subject: {req.subject}\nStyles: {', '.join(req.styles)}\nMoods: {', '.join(req.moods)}\nPlatform: {req.platform}"

    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=user_content,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.9,
                max_output_tokens=512,
            )
        )
        return {"prompt": response.text.strip(), "model": "gemini-2.5-flash"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

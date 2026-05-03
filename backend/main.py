from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import httpx
from google import genai
from google.genai import types
from dotenv import load_dotenv
from sqlalchemy.orm import Session
import database
import models

load_dotenv()

models.Base.metadata.create_all(bind=database.engine)

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
    image_base64: Optional[str] = None
    mime_type: Optional[str] = "image/jpeg"

class ImageGenerateRequest(BaseModel):
    prompt: str
    aspect_ratio: Optional[str] = "1:1"

class CritiqueRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"
    personality: str = "Snobby Curator"

class ContinueRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"

class MutateRequest(BaseModel):
    image_base64: str
    mutation_prompt: str
    mime_type: Optional[str] = "image/jpeg"

class ComicRequest(BaseModel):
    story: str

class HistoryRequest(BaseModel):
    prompt: str
    image_base64: str

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

    contents = []
    if req.image_base64:
        import base64
        image_bytes = base64.b64decode(req.image_base64.split(",")[1] if "," in req.image_base64 else req.image_base64)
        contents.append(
            types.Part.from_bytes(data=image_bytes, mime_type=req.mime_type)
        )
    contents.append(user_content)

    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.9,
                max_output_tokens=512,
            )
        )
        return {"prompt": response.text.strip(), "model": "gemini-2.5-flash"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate/image")
async def generate_image(req: ImageGenerateRequest):
    freepik_key = os.environ.get("FREEPIK_API_KEY")
    
    # Try Freepik first if key is available
    if freepik_key:
        try:
            headers = {
                "x-freepik-api-key": freepik_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
            # Map aspect ratio
            ar_map = {"1:1": "square", "16:9": "widescreen_16_9", "4:3": "standard_4_3", "3:2": "classic_3_2"}
            freepik_ar = ar_map.get(req.aspect_ratio, "square")

            payload = {
                "prompt": req.prompt,
                "aspect_ratio": freepik_ar,
                "num_images": 1,
                "image": {"size": "large"}
            }

            async with httpx.AsyncClient() as client:
                # 1. Start the task
                resp = await client.post("https://api.freepik.com/v1/ai/text-to-image", json=payload, headers=headers, timeout=60.0)
                
                if resp.status_code == 200:
                    data = resp.json()
                    image_url = None
                    
                    # Some endpoints return data directly or a task object
                    if "data" in data:
                        inner_data = data["data"]
                        
                        # Case A: Direct URL or Base64 (Rare for heavy models)
                        if isinstance(inner_data, list) and len(inner_data) > 0:
                            image_url = inner_data[0].get("url")
                        
                        # Case B: Task ID (Common for Flux/Heavy models)
                        elif "task_id" in inner_data:
                            task_id = inner_data["task_id"]
                            import asyncio
                            # Poll for completion (up to 45 seconds)
                            for _ in range(15): 
                                await asyncio.sleep(3)
                                task_resp = await client.get(f"https://api.freepik.com/v1/ai/tasks/{task_id}", headers=headers)
                                if task_resp.status_code == 200:
                                    task_data = task_resp.json().get("data", {})
                                    if task_data.get("status") == "COMPLETED":
                                        result = task_data.get("result", {})
                                        if "images" in result and len(result["images"]) > 0:
                                            image_url = result["images"][0].get("url")
                                            break
                                    elif task_data.get("status") == "FAILED":
                                        break
                    
                    if image_url:
                        # Fetch the final image and convert to Base64
                        final_img_resp = await client.get(image_url)
                        if final_img_resp.status_code == 200:
                            import base64
                            b64 = base64.b64encode(final_img_resp.content).decode('utf-8')
                            return {"image_base64": b64, "mime_type": "image/jpeg", "source": "freepik"}

        except Exception as e:
            print(f"Freepik failed: {str(e)}") # Fallback to Pollinations below

    # Fallback to Pollinations.ai (Free & Reliable)
    try:
        import urllib.parse
        encoded_prompt = urllib.parse.quote(req.prompt)
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&private=true&enhance=false&model=flux"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url, timeout=60.0)
            if response.status_code == 200:
                import base64
                b64_string = base64.b64encode(response.content).decode('utf-8')
                return {"image_base64": b64_string, "mime_type": "image/jpeg", "source": "pollinations"}
            
        raise HTTPException(status_code=500, detail="Failed to generate image with any service")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/critique")
def critique_image(req: CritiqueRequest):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Image base64 is required")
        
    system_prompt = ""
    if req.personality == "Snobby Curator":
        system_prompt = "You are a pretentious, snobby fine-art curator in an avant-garde gallery. Critique this image harshly but with extremely sophisticated vocabulary. Output a single short paragraph."
    elif req.personality == "Aggressive Roaster":
        system_prompt = "You are an aggressive internet troll who roasts art. Be funny, sarcastic, and brutally honest about the flaws in this image. Output a single short paragraph."
    else: # Supportive Bob Ross
        system_prompt = "You are Bob Ross. You are incredibly supportive, gentle, and positive. Find the 'happy little accidents' in this image and praise it warmly. Output a single short paragraph."

    import base64
    try:
        image_data = req.image_base64.split(",")[1] if "," in req.image_base64 else req.image_base64
        image_bytes = base64.b64decode(image_data)
        
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=req.mime_type),
            "Please critique this piece."
        ]
        
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.9,
            )
        )
        return {"critique": response.text.strip(), "personality": req.personality}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/history")
def save_history(req: HistoryRequest, db: Session = Depends(database.get_db)):
    db_history = models.GenerationHistory(
        prompt=req.prompt,
        image_base64=req.image_base64
    )
    db.add(db_history)
    db.commit()
    db.refresh(db_history)
    return {"status": "success", "id": db_history.id}

@app.get("/history")
def get_history(db: Session = Depends(database.get_db), skip: int = 0, limit: int = 50):
    history = db.query(models.GenerationHistory).order_by(models.GenerationHistory.created_at.desc()).offset(skip).limit(limit).all()
    return [
        {
            "id": h.id,
            "prompt": h.prompt,
            "image_base64": h.image_base64,
            "created_at": h.created_at
        } for h in history
    ]

@app.post("/continue")
async def continue_story(req: ContinueRequest):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Image base64 is required")
        
    system_prompt = "You are a master storyteller and AI art prompt engineer. Look at this image. What happens exactly 5 minutes later in this story? Write a highly detailed AI art prompt for the NEXT scene. Output ONLY the art prompt, nothing else. No introductions or explanations."

    import base64
    try:
        # 1. Ask Gemini for the next prompt based on the image
        image_data = req.image_base64.split(",")[1] if "," in req.image_base64 else req.image_base64
        image_bytes = base64.b64decode(image_data)
        
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=req.mime_type),
            "What happens next?"
        ]
        
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.9,
            )
        )
        
        next_prompt = response.text.strip()
        
        # 2. Call Freepik / Pollinations directly to generate the new image
        import urllib.parse
        encoded_prompt = urllib.parse.quote(next_prompt)
        # Using Pollinations here for speed and reliability in the continuation
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&private=true&enhance=false&model=flux"
        
        async with httpx.AsyncClient() as http_client:
            poll_resp = await http_client.get(image_url, timeout=60.0)
            if poll_resp.status_code == 200:
                b64_string = base64.b64encode(poll_resp.content).decode('utf-8')
                return {"prompt": next_prompt, "image_base64": b64_string}
                
        raise HTTPException(status_code=500, detail="Failed to generate the next scene.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mutate")
async def mutate_image(req: MutateRequest):
    if not req.image_base64:
        raise HTTPException(status_code=400, detail="Image base64 is required")
        
    system_prompt = f"You are a master AI art prompt engineer. Look at this image. The user wants to mutate it with this command: '{req.mutation_prompt}'. Analyze the exact composition, characters, and setting of the original image, and write a new, highly detailed AI art prompt that perfectly matches the original structure but applies the mutation perfectly. Output ONLY the art prompt."

    import base64
    try:
        image_data = req.image_base64.split(",")[1] if "," in req.image_base64 else req.image_base64
        image_bytes = base64.b64decode(image_data)
        
        contents = [
            types.Part.from_bytes(data=image_bytes, mime_type=req.mime_type),
            f"Mutate this image: {req.mutation_prompt}"
        ]
        
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=contents,
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.7,
            )
        )
        
        mutated_prompt = response.text.strip()
        
        import urllib.parse
        encoded_prompt = urllib.parse.quote(mutated_prompt)
        image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&private=true&enhance=false&model=flux"
        
        async with httpx.AsyncClient() as http_client:
            poll_resp = await http_client.get(image_url, timeout=60.0)
            if poll_resp.status_code == 200:
                b64_string = base64.b64encode(poll_resp.content).decode('utf-8')
                return {"prompt": mutated_prompt, "image_base64": b64_string}
                
        raise HTTPException(status_code=500, detail="Failed to mutate image.")
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

import asyncio
import json

@app.post("/comic")
async def generate_comic(req: ComicRequest):
    if not req.story.strip():
        raise HTTPException(status_code=400, detail="Story is required")
        
    system_prompt = "You are a master comic book director. Take the user's story and divide it into exactly 4 distinct visual scenes. For each scene, write a highly descriptive AI art prompt AND a short, dramatic caption (max 15 words) for the comic panel. Output valid JSON in this exact format, with no markdown formatting: [{\"prompt\": \"...\", \"caption\": \"...\"}, ...]"

    try:
        client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=[req.story],
            config=types.GenerateContentConfig(
                system_instruction=system_prompt,
                temperature=0.8,
            )
        )
        
        text_resp = response.text.strip()
        if text_resp.startswith('```json'):
            text_resp = text_resp[7:]
        if text_resp.endswith('```'):
            text_resp = text_resp[:-3]
            
        panels = json.loads(text_resp)
        if len(panels) != 4:
            # Fallback if Gemini fails to give exactly 4
            panels = (panels + [{"prompt": "A dramatic continuation", "caption": "..."}] * 4)[:4]

        import urllib.parse
        import base64

        async def fetch_image(panel):
            encoded_prompt = urllib.parse.quote(panel["prompt"])
            image_url = f"https://image.pollinations.ai/prompt/{encoded_prompt}?width=1024&height=1024&nologo=true&private=true&enhance=false&model=flux"
            try:
                async with httpx.AsyncClient() as http_client:
                    poll_resp = await http_client.get(image_url, timeout=120.0)
                    if poll_resp.status_code == 200:
                        b64_string = base64.b64encode(poll_resp.content).decode('utf-8')
                        return {"caption": panel["caption"], "image_base64": b64_string}
            except Exception as e:
                print(f"Error fetching panel: {e}")
            return {"caption": panel["caption"], "image_base64": ""}

        results = []
        for p in panels:
            res = await fetch_image(p)
            if res["image_base64"]:
                results.append(res)
            # Add a small delay to avoid hitting rate limits
            await asyncio.sleep(1)
        
        # Filter out failed images just in case
        if len(results) == 0:
            raise HTTPException(status_code=500, detail="The server is under heavy load and all comic panels timed out. Please try again.")

        return {"panels": results}

    except HTTPException:
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        err_msg = str(e)
        if not err_msg:
            err_msg = "An unexpected error occurred during comic generation."
        raise HTTPException(status_code=500, detail=err_msg)

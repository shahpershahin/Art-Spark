from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import httpx
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
    image_base64: Optional[str] = None
    mime_type: Optional[str] = "image/jpeg"

class ImageGenerateRequest(BaseModel):
    prompt: str
    aspect_ratio: Optional[str] = "1:1"

class CritiqueRequest(BaseModel):
    image_base64: str
    mime_type: Optional[str] = "image/jpeg"
    personality: str = "Snobby Curator"

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

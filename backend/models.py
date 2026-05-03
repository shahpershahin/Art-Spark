from sqlalchemy import Column, Integer, String, DateTime
from database import Base
from datetime import datetime

class GenerationHistory(Base):
    __tablename__ = "generation_history"

    id = Column(Integer, primary_key=True, index=True)
    prompt = Column(String, index=True)
    image_base64 = Column(String)  # We will store the base64 string directly
    created_at = Column(DateTime, default=datetime.utcnow)

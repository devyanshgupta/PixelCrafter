import os
import uuid
import base64
import json
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException, Depends, status, WebSocket, WebSocketDisconnect, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
import jwt
from passlib.context import CryptContext
import asyncio

# Environment variables
MONGO_URL = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-super-secret-jwt-key-change-in-production')
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')

app = FastAPI(title="PixelCrafter API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# MongoDB client
mongo_client = AsyncIOMotorClient(MONGO_URL)
db = mongo_client.pixelcrafter

# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, project_id: str):
        await websocket.accept()
        if project_id not in self.active_connections:
            self.active_connections[project_id] = []
        self.active_connections[project_id].append(websocket)

    def disconnect(self, websocket: WebSocket, project_id: str):
        if project_id in self.active_connections:
            self.active_connections[project_id].remove(websocket)
            if not self.active_connections[project_id]:
                del self.active_connections[project_id]

    async def broadcast_to_project(self, project_id: str, message: dict):
        if project_id in self.active_connections:
            for connection in self.active_connections[project_id].copy():
                try:
                    await connection.send_json(message)
                except:
                    self.active_connections[project_id].remove(connection)

manager = ConnectionManager()

# Pydantic models
class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class User(BaseModel):
    id: str
    username: str
    email: str
    created_at: datetime

class Layer(BaseModel):
    id: str
    name: str
    type: str  # 'image', 'text', 'shape', 'brush'
    visible: bool = True
    opacity: float = 1.0
    x: float = 0
    y: float = 0
    width: float = 0
    height: float = 0
    data: dict = {}  # Contains layer-specific data (text content, image data, etc.)
    z_index: int = 0

class Project(BaseModel):
    id: str
    name: str
    width: int
    height: int
    background_color: str = "#ffffff"
    layers: List[Layer] = []
    owner_id: str
    created_at: datetime
    updated_at: datetime

class ProjectCreate(BaseModel):
    name: str
    width: int = 1920
    height: int = 1080
    background_color: str = "#ffffff"

class ChatMessage(BaseModel):
    message: str
    session_id: str

class ChatResponse(BaseModel):
    response: str
    session_id: str

class CollaborationMessage(BaseModel):
    type: str  # 'cursor', 'layer_update', 'tool_change'
    data: dict
    user_id: str

# Utility functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(hours=24)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm="HS256")
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=["HS256"])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    user = await db.users.find_one({"id": user_id})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    
    return User(**user)

# Routes
@app.get("/api/health")
async def health_check():
    return {"status": "healthy", "service": "PixelCrafter API"}

@app.post("/api/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create user
    user_id = str(uuid.uuid4())
    hashed_password = get_password_hash(user_data.password)
    
    user_doc = {
        "id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password": hashed_password,
        "created_at": datetime.utcnow()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create access token
    access_token = create_access_token(data={"sub": user_id})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user_id,
            "username": user_data.username,
            "email": user_data.email
        }
    }

@app.post("/api/auth/login")
async def login(login_data: UserLogin):
    user = await db.users.find_one({"email": login_data.email})
    if not user or not verify_password(login_data.password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token(data={"sub": user["id"]})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "email": user["email"]
        }
    }

@app.get("/api/auth/me")
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

@app.post("/api/projects")
async def create_project(project_data: ProjectCreate, current_user: User = Depends(get_current_user)):
    project_id = str(uuid.uuid4())
    
    project_doc = {
        "id": project_id,
        "name": project_data.name,
        "width": project_data.width,
        "height": project_data.height,
        "background_color": project_data.background_color,
        "layers": [],
        "owner_id": current_user.id,
        "created_at": datetime.utcnow(),
        "updated_at": datetime.utcnow()
    }
    
    await db.projects.insert_one(project_doc)
    
    return Project(**project_doc)

@app.get("/api/projects")
async def get_user_projects(current_user: User = Depends(get_current_user)):
    projects = await db.projects.find({"owner_id": current_user.id}).to_list(100)
    return [Project(**project) for project in projects]

@app.get("/api/projects/{project_id}")
async def get_project(project_id: str, current_user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "owner_id": current_user.id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return Project(**project)

@app.put("/api/projects/{project_id}")
async def update_project(project_id: str, project_data: dict, current_user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "owner_id": current_user.id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {
        **project_data,
        "updated_at": datetime.utcnow()
    }
    
    await db.projects.update_one(
        {"id": project_id},
        {"$set": update_data}
    )
    
    # Broadcast update to collaborators
    await manager.broadcast_to_project(project_id, {
        "type": "project_update",
        "data": update_data,
        "user_id": current_user.id
    })
    
    updated_project = await db.projects.find_one({"id": project_id})
    return Project(**updated_project)

@app.delete("/api/projects/{project_id}")
async def delete_project(project_id: str, current_user: User = Depends(get_current_user)):
    result = await db.projects.delete_one({"id": project_id, "owner_id": current_user.id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {"message": "Project deleted successfully"}

@app.post("/api/projects/{project_id}/upload-image")
async def upload_image(project_id: str, file: UploadFile = File(...), current_user: User = Depends(get_current_user)):
    # Verify project access
    project = await db.projects.find_one({"id": project_id, "owner_id": current_user.id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Read and encode image
    contents = await file.read()
    image_base64 = base64.b64encode(contents).decode('utf-8')
    
    # Create a new image layer
    layer_id = str(uuid.uuid4())
    layer = {
        "id": layer_id,
        "name": f"Image Layer - {file.filename}",
        "type": "image",
        "visible": True,
        "opacity": 1.0,
        "x": 0,
        "y": 0,
        "width": 300,  # Default width, should be adjusted based on actual image size
        "height": 200,  # Default height
        "data": {
            "src": f"data:image/{file.content_type.split('/')[-1]};base64,{image_base64}",
            "filename": file.filename
        },
        "z_index": len(project.get("layers", []))
    }
    
    # Add layer to project
    await db.projects.update_one(
        {"id": project_id},
        {
            "$push": {"layers": layer},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    return {"layer": layer, "message": "Image uploaded successfully"}

@app.post("/api/chat")
async def chat_with_assistant(chat_data: ChatMessage):
    if not GEMINI_API_KEY:
        raise HTTPException(status_code=503, detail="AI assistant is not configured. Please add GEMINI_API_KEY to environment variables.")
    
    try:
        # Import and use Gemini integration
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        
        # Initialize chat with design-focused system message
        chat = LlmChat(
            api_key=GEMINI_API_KEY,
            session_id=chat_data.session_id,
            system_message="""You are PixelCrafter AI, an expert design assistant for a canvas-based image editor similar to Photoshop. 

Your role is to:
1. Provide helpful design tips and suggestions
2. Recommend appropriate filters and effects for different scenarios
3. Guide users through complex editing workflows
4. Suggest color palettes and compositions
5. Help troubleshoot design challenges
6. Offer creative inspiration for various design projects

Always be encouraging, creative, and practical in your responses. Keep suggestions actionable and relevant to digital image editing."""
        ).with_model("gemini", "gemini-2.0-flash")
        
        # Create user message
        user_message = UserMessage(text=chat_data.message)
        
        # Get response
        response = await chat.send_message(user_message)
        
        # Store chat message in database
        chat_doc = {
            "session_id": chat_data.session_id,
            "user_message": chat_data.message,
            "ai_response": response,
            "timestamp": datetime.utcnow()
        }
        await db.chat_history.insert_one(chat_doc)
        
        return ChatResponse(response=response, session_id=chat_data.session_id)
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI assistant error: {str(e)}")

@app.get("/api/chat/history/{session_id}")
async def get_chat_history(session_id: str, limit: int = 50):
    messages = await db.chat_history.find(
        {"session_id": session_id}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    return {"messages": messages[::-1]}  # Reverse to get chronological order

@app.websocket("/api/ws/collaborate/{project_id}")
async def websocket_collaboration(websocket: WebSocket, project_id: str):
    await manager.connect(websocket, project_id)
    try:
        while True:
            data = await websocket.receive_json()
            # Broadcast collaboration message to all users in the project
            await manager.broadcast_to_project(project_id, data)
    except WebSocketDisconnect:
        manager.disconnect(websocket, project_id)

# Image processing endpoints
@app.post("/api/projects/{project_id}/filters/blur")
async def apply_blur_filter(project_id: str, layer_id: str, blur_amount: float = 5.0, current_user: User = Depends(get_current_user)):
    # Placeholder for blur filter implementation
    # In a real implementation, you would process the layer's image data
    return {"message": f"Blur filter applied to layer {layer_id} with amount {blur_amount}"}

@app.post("/api/projects/{project_id}/filters/brightness")
async def apply_brightness_filter(project_id: str, layer_id: str, brightness: float = 1.2, current_user: User = Depends(get_current_user)):
    # Placeholder for brightness filter implementation
    return {"message": f"Brightness filter applied to layer {layer_id} with value {brightness}"}

@app.post("/api/projects/{project_id}/export")
async def export_project(project_id: str, format: str = "png", current_user: User = Depends(get_current_user)):
    project = await db.projects.find_one({"id": project_id, "owner_id": current_user.id})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # In a real implementation, you would render all layers into a single image
    # For now, return project data that can be processed on the frontend
    return {
        "project": project,
        "export_format": format,
        "message": "Project data ready for export"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
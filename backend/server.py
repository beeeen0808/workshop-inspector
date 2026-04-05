from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx
import base64

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'machinery-inspection-secret-key-2025')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS = 7

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

security = HTTPBearer(auto_error=False)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    username: str
    email: str
    password: str

class UserLogin(BaseModel):
    email: str
    password: str

class UserResponse(BaseModel):
    user_id: str
    username: str
    email: str
    name: Optional[str] = None
    picture: Optional[str] = None
    created_at: datetime

class MachineCreate(BaseModel):
    name: str
    category: str  # woodworking, metalworking
    description: Optional[str] = None
    location: Optional[str] = None

class MachineUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None

class MachineResponse(BaseModel):
    machine_id: str
    name: str
    category: str
    description: Optional[str] = None
    location: Optional[str] = None
    qr_code_data: str
    created_by: str
    created_at: datetime
    updated_at: datetime

class CheckItemCreate(BaseModel):
    text: str
    check_type: str  # "yesno" or "multiple_choice"
    options: Optional[List[str]] = None  # For multiple choice

class ChecklistTemplateCreate(BaseModel):
    name: str
    category: str  # woodworking, metalworking, general
    description: Optional[str] = None
    check_items: List[CheckItemCreate]

class ChecklistTemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    check_items: Optional[List[CheckItemCreate]] = None

class ChecklistTemplateResponse(BaseModel):
    template_id: str
    name: str
    category: str
    description: Optional[str] = None
    check_items: List[Dict[str, Any]]
    created_by: str
    created_at: datetime
    updated_at: datetime

class CheckResponse(BaseModel):
    check_id: str
    text: str
    check_type: str
    options: Optional[List[str]] = None
    response: Optional[str] = None  # "yes", "no", or selected option

class InspectionCreate(BaseModel):
    machine_id: str
    template_id: Optional[str] = None
    check_responses: List[CheckResponse]
    text_notes: Optional[str] = None
    photo_notes: Optional[List[str]] = None  # Base64 encoded photos
    voice_notes: Optional[List[str]] = None  # Base64 encoded audio

class InspectionResponse(BaseModel):
    inspection_id: str
    machine_id: str
    machine_name: str
    template_id: Optional[str] = None
    template_name: Optional[str] = None
    check_responses: List[Dict[str, Any]]
    text_notes: Optional[str] = None
    photo_notes: Optional[List[str]] = None
    voice_notes: Optional[List[str]] = None
    inspector_id: str
    inspector_name: str
    created_at: datetime

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str) -> str:
    expiry = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    payload = {
        "user_id": user_id,
        "exp": expiry
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_jwt_token(token: str) -> Optional[Dict]:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> dict:
    token = None
    
    # Check cookies first
    session_token = request.cookies.get("session_token")
    if session_token:
        # Google OAuth session
        session = await db.user_sessions.find_one(
            {"session_token": session_token},
            {"_id": 0}
        )
        if session:
            expires_at = session.get("expires_at")
            if isinstance(expires_at, str):
                expires_at = datetime.fromisoformat(expires_at)
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at > datetime.now(timezone.utc):
                user = await db.users.find_one(
                    {"user_id": session["user_id"]},
                    {"_id": 0}
                )
                if user:
                    return user
    
    # Check Authorization header (JWT)
    if credentials:
        token = credentials.credentials
        payload = decode_jwt_token(token)
        if payload:
            user = await db.users.find_one(
                {"user_id": payload["user_id"]},
                {"_id": 0}
            )
            if user:
                return user
    
    raise HTTPException(status_code=401, detail="Not authenticated")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate):
    # Check if user exists
    existing = await db.users.find_one({"email": user_data.email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    existing_username = await db.users.find_one({"username": user_data.username})
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    hashed_pw = hash_password(user_data.password)
    
    user_doc = {
        "user_id": user_id,
        "username": user_data.username,
        "email": user_data.email,
        "password_hash": hashed_pw,
        "name": user_data.username,
        "picture": None,
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.users.insert_one(user_doc)
    
    token = create_jwt_token(user_id)
    
    return {
        "token": token,
        "user": {
            "user_id": user_id,
            "username": user_data.username,
            "email": user_data.email,
            "name": user_data.username
        }
    }

@api_router.post("/auth/login")
async def login(user_data: UserLogin):
    user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if not user.get("password_hash"):
        raise HTTPException(status_code=401, detail="Please use Google login for this account")
    
    if not verify_password(user_data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_jwt_token(user["user_id"])
    
    return {
        "token": token,
        "user": {
            "user_id": user["user_id"],
            "username": user.get("username", user.get("name", "")),
            "email": user["email"],
            "name": user.get("name", user.get("username", ""))
        }
    }

@api_router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    """Exchange Google OAuth session_id for user session"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client:
        try:
            auth_response = await client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if auth_response.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            user_data = auth_response.json()
        except Exception as e:
            logger.error(f"Google auth error: {e}")
            raise HTTPException(status_code=500, detail="Authentication failed")
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": user_data["email"]}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {
                "name": user_data.get("name", existing_user.get("name")),
                "picture": user_data.get("picture", existing_user.get("picture"))
            }}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "username": user_data.get("name", "").replace(" ", "_").lower() or f"user_{user_id[:8]}",
            "email": user_data["email"],
            "name": user_data.get("name", ""),
            "picture": user_data.get("picture"),
            "created_at": datetime.now(timezone.utc)
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    session_token = user_data.get("session_token", f"session_{uuid.uuid4().hex}")
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at,
        "created_at": datetime.now(timezone.utc)
    })
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7*24*60*60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    
    return {
        "user": {
            "user_id": user["user_id"],
            "username": user.get("username", user.get("name", "")),
            "email": user["email"],
            "name": user.get("name", ""),
            "picture": user.get("picture")
        }
    }

@api_router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "username": current_user.get("username", current_user.get("name", "")),
        "email": current_user["email"],
        "name": current_user.get("name", ""),
        "picture": current_user.get("picture")
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ==================== MACHINE ENDPOINTS ====================

@api_router.post("/machines", response_model=MachineResponse)
async def create_machine(
    machine: MachineCreate,
    current_user: dict = Depends(get_current_user)
):
    machine_id = f"machine_{uuid.uuid4().hex[:12]}"
    qr_code_data = f"MACHINE:{machine_id}"
    
    machine_doc = {
        "machine_id": machine_id,
        "name": machine.name,
        "category": machine.category,
        "description": machine.description,
        "location": machine.location,
        "qr_code_data": qr_code_data,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.machines.insert_one(machine_doc)
    return MachineResponse(**machine_doc)

@api_router.get("/machines", response_model=List[MachineResponse])
async def get_machines(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category:
        query["category"] = category
    
    machines = await db.machines.find(query, {"_id": 0}).to_list(1000)
    return [MachineResponse(**m) for m in machines]

@api_router.get("/machines/{machine_id}", response_model=MachineResponse)
async def get_machine(
    machine_id: str,
    current_user: dict = Depends(get_current_user)
):
    machine = await db.machines.find_one({"machine_id": machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    return MachineResponse(**machine)

@api_router.get("/machines/qr/{qr_code_data:path}")
async def get_machine_by_qr(
    qr_code_data: str,
    current_user: dict = Depends(get_current_user)
):
    machine = await db.machines.find_one({"qr_code_data": qr_code_data}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    return MachineResponse(**machine)

@api_router.put("/machines/{machine_id}", response_model=MachineResponse)
async def update_machine(
    machine_id: str,
    machine_update: MachineUpdate,
    current_user: dict = Depends(get_current_user)
):
    machine = await db.machines.find_one({"machine_id": machine_id})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    update_data = {k: v for k, v in machine_update.dict().items() if v is not None}
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.machines.update_one(
        {"machine_id": machine_id},
        {"$set": update_data}
    )
    
    updated = await db.machines.find_one({"machine_id": machine_id}, {"_id": 0})
    return MachineResponse(**updated)

@api_router.delete("/machines/{machine_id}")
async def delete_machine(
    machine_id: str,
    current_user: dict = Depends(get_current_user)
):
    result = await db.machines.delete_one({"machine_id": machine_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Machine not found")
    return {"message": "Machine deleted successfully"}

# ==================== CHECKLIST TEMPLATE ENDPOINTS ====================

@api_router.post("/templates", response_model=ChecklistTemplateResponse)
async def create_template(
    template: ChecklistTemplateCreate,
    current_user: dict = Depends(get_current_user)
):
    template_id = f"template_{uuid.uuid4().hex[:12]}"
    
    check_items = []
    for item in template.check_items:
        check_items.append({
            "check_id": f"check_{uuid.uuid4().hex[:8]}",
            "text": item.text,
            "check_type": item.check_type,
            "options": item.options if item.check_type == "multiple_choice" else None
        })
    
    template_doc = {
        "template_id": template_id,
        "name": template.name,
        "category": template.category,
        "description": template.description,
        "check_items": check_items,
        "created_by": current_user["user_id"],
        "created_at": datetime.now(timezone.utc),
        "updated_at": datetime.now(timezone.utc)
    }
    
    await db.checklist_templates.insert_one(template_doc)
    return ChecklistTemplateResponse(**template_doc)

@api_router.get("/templates", response_model=List[ChecklistTemplateResponse])
async def get_templates(
    category: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if category:
        query["category"] = category
    
    templates = await db.checklist_templates.find(query, {"_id": 0}).to_list(1000)
    return [ChecklistTemplateResponse(**t) for t in templates]

@api_router.get("/templates/{template_id}", response_model=ChecklistTemplateResponse)
async def get_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    template = await db.checklist_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return ChecklistTemplateResponse(**template)

@api_router.put("/templates/{template_id}", response_model=ChecklistTemplateResponse)
async def update_template(
    template_id: str,
    template_update: ChecklistTemplateUpdate,
    current_user: dict = Depends(get_current_user)
):
    template = await db.checklist_templates.find_one({"template_id": template_id})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = {}
    if template_update.name is not None:
        update_data["name"] = template_update.name
    if template_update.category is not None:
        update_data["category"] = template_update.category
    if template_update.description is not None:
        update_data["description"] = template_update.description
    if template_update.check_items is not None:
        check_items = []
        for item in template_update.check_items:
            check_items.append({
                "check_id": f"check_{uuid.uuid4().hex[:8]}",
                "text": item.text,
                "check_type": item.check_type,
                "options": item.options if item.check_type == "multiple_choice" else None
            })
        update_data["check_items"] = check_items
    
    update_data["updated_at"] = datetime.now(timezone.utc)
    
    await db.checklist_templates.update_one(
        {"template_id": template_id},
        {"$set": update_data}
    )
    
    updated = await db.checklist_templates.find_one({"template_id": template_id}, {"_id": 0})
    return ChecklistTemplateResponse(**updated)

@api_router.delete("/templates/{template_id}")
async def delete_template(
    template_id: str,
    current_user: dict = Depends(get_current_user)
):
    result = await db.checklist_templates.delete_one({"template_id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted successfully"}

# ==================== INSPECTION ENDPOINTS ====================

@api_router.post("/inspections", response_model=InspectionResponse)
async def create_inspection(
    inspection: InspectionCreate,
    current_user: dict = Depends(get_current_user)
):
    # Validate machine exists
    machine = await db.machines.find_one({"machine_id": inspection.machine_id}, {"_id": 0})
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    
    template_name = None
    if inspection.template_id:
        template = await db.checklist_templates.find_one(
            {"template_id": inspection.template_id}, 
            {"_id": 0}
        )
        if template:
            template_name = template["name"]
    
    inspection_id = f"inspection_{uuid.uuid4().hex[:12]}"
    
    inspection_doc = {
        "inspection_id": inspection_id,
        "machine_id": inspection.machine_id,
        "machine_name": machine["name"],
        "template_id": inspection.template_id,
        "template_name": template_name,
        "check_responses": [r.dict() for r in inspection.check_responses],
        "text_notes": inspection.text_notes,
        "photo_notes": inspection.photo_notes or [],
        "voice_notes": inspection.voice_notes or [],
        "inspector_id": current_user["user_id"],
        "inspector_name": current_user.get("name", current_user.get("username", "")),
        "created_at": datetime.now(timezone.utc)
    }
    
    await db.inspections.insert_one(inspection_doc)
    return InspectionResponse(**inspection_doc)

@api_router.get("/inspections", response_model=List[InspectionResponse])
async def get_inspections(
    machine_id: Optional[str] = None,
    limit: int = 50,
    current_user: dict = Depends(get_current_user)
):
    query = {}
    if machine_id:
        query["machine_id"] = machine_id
    
    inspections = await db.inspections.find(
        query, 
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return [InspectionResponse(**i) for i in inspections]

@api_router.get("/inspections/{inspection_id}", response_model=InspectionResponse)
async def get_inspection(
    inspection_id: str,
    current_user: dict = Depends(get_current_user)
):
    inspection = await db.inspections.find_one({"inspection_id": inspection_id}, {"_id": 0})
    if not inspection:
        raise HTTPException(status_code=404, detail="Inspection not found")
    return InspectionResponse(**inspection)

@api_router.get("/machines/{machine_id}/inspections", response_model=List[InspectionResponse])
async def get_machine_inspections(
    machine_id: str,
    limit: int = 100,
    current_user: dict = Depends(get_current_user)
):
    inspections = await db.inspections.find(
        {"machine_id": machine_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(limit)
    
    return [InspectionResponse(**i) for i in inspections]

# ==================== SEED DATA ====================

@api_router.post("/seed")
async def seed_data():
    """Seed default checklist templates for woodworking and metalworking"""
    
    # Check if templates already exist
    existing = await db.checklist_templates.find_one({"name": "Woodworking General Safety"})
    if existing:
        return {"message": "Seed data already exists"}
    
    system_user_id = "system"
    
    templates = [
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "name": "Woodworking General Safety",
            "category": "woodworking",
            "description": "Standard safety checklist for woodworking machines",
            "check_items": [
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Guards and safety devices in place and working", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Emergency stop button accessible and functional", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Dust extraction system connected and working", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Work area clear of debris", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Blade/cutter condition", "check_type": "multiple_choice", "options": ["Good", "Fair", "Needs Replacement"]},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Power cord condition", "check_type": "multiple_choice", "options": ["Good", "Damaged", "Frayed"]}
            ],
            "created_by": system_user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "name": "Table Saw Checklist",
            "category": "woodworking",
            "description": "Specific checklist for table saw inspection",
            "check_items": [
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Blade guard installed", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Riving knife aligned", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Anti-kickback pawls functional", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Fence alignment accurate", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Table surface condition", "check_type": "multiple_choice", "options": ["Clean", "Needs Cleaning", "Damaged"]},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Push stick available", "check_type": "yesno", "options": None}
            ],
            "created_by": system_user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "name": "Metalworking General Safety",
            "category": "metalworking",
            "description": "Standard safety checklist for metalworking machines",
            "check_items": [
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Machine guards in place", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Emergency stop accessible", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Coolant level adequate", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Chip removal performed", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Lubrication status", "check_type": "multiple_choice", "options": ["Good", "Needs Lubrication", "Overdue"]},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Tool condition", "check_type": "multiple_choice", "options": ["Sharp", "Dull", "Damaged"]}
            ],
            "created_by": system_user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "name": "Lathe Checklist",
            "category": "metalworking",
            "description": "Specific checklist for lathe inspection",
            "check_items": [
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Chuck properly secured", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Chuck key removed after use", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Tool rest secure", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Tailstock alignment", "check_type": "multiple_choice", "options": ["Aligned", "Needs Adjustment", "Severely Misaligned"]},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Speed selection appropriate", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Bed ways lubricated", "check_type": "yesno", "options": None}
            ],
            "created_by": system_user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        },
        {
            "template_id": f"template_{uuid.uuid4().hex[:12]}",
            "name": "Drill Press Checklist",
            "category": "metalworking",
            "description": "Checklist for drill press inspection",
            "check_items": [
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Chuck key removed", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Work piece secured", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Correct drill bit for material", "check_type": "yesno", "options": None},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Table alignment", "check_type": "multiple_choice", "options": ["Level", "Slightly Off", "Needs Adjustment"]},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Belt condition", "check_type": "multiple_choice", "options": ["Good", "Worn", "Needs Replacement"]},
                {"check_id": f"check_{uuid.uuid4().hex[:8]}", "text": "Depth stop set correctly", "check_type": "yesno", "options": None}
            ],
            "created_by": system_user_id,
            "created_at": datetime.now(timezone.utc),
            "updated_at": datetime.now(timezone.utc)
        }
    ]
    
    await db.checklist_templates.insert_many(templates)
    return {"message": "Seed data created successfully", "templates_created": len(templates)}

# ==================== ROOT ENDPOINT ====================

@api_router.get("/")
async def root():
    return {"message": "Machinery Inspection API", "version": "1.0.0"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

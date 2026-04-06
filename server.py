from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Response
from fastapi.responses import JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import asyncio
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import resend
import httpx

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Config
JWT_SECRET = os.environ.get('JWT_SECRET_KEY', 'default-secret-key')
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 24 * 7  # 7 days

# Resend Config
resend.api_key = os.environ.get('RESEND_API_KEY', '')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', 'onboarding@resend.dev')

# Create the main app
app = FastAPI(title="Client Portal API")

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==================== MODELS ====================

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: str = "admin"  # admin or client

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "admin"
    created_at: datetime

class ClientInvite(BaseModel):
    email: EmailStr
    name: str
    associated_client_id: str  # Link to the client record

class ClientCreate(BaseModel):
    name: str
    email: EmailStr
    company: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    posting_frequency: str = "3_per_week"  # daily, 3_per_week, 2_per_week, 1_per_week
    service_ids: List[str] = []
    plan_id: Optional[str] = None  # Social media plan

class ClientUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    company: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    posting_frequency: Optional[str] = None
    service_ids: Optional[List[str]] = None
    plan_id: Optional[str] = None

class Client(BaseModel):
    client_id: str
    user_id: str
    name: str
    email: str
    company: Optional[str] = None
    phone: Optional[str] = None
    notes: Optional[str] = None
    posting_frequency: str = "3_per_week"
    service_ids: List[str] = []
    plan_id: Optional[str] = None
    created_at: datetime

# Service models
class ServiceCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None

class Service(BaseModel):
    service_id: str
    user_id: str
    name: str
    description: Optional[str] = None
    price: float
    created_at: datetime

# Posting frequency configuration
POSTING_FREQUENCIES = {
    "daily": {"label": "Todos os dias", "posts_per_month": 30},
    "5_per_week": {"label": "5x por semana", "posts_per_month": 22},
    "4_per_week": {"label": "4x por semana", "posts_per_month": 17},
    "3_per_week": {"label": "3x por semana", "posts_per_month": 13},
    "2_per_week": {"label": "2x por semana", "posts_per_month": 9},
    "1_per_week": {"label": "1x por semana", "posts_per_month": 4},
}

# Social Media Plans Models
class SocialPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    frequency: str  # 3_per_week, 4_per_week, etc.

class SocialPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    frequency: Optional[str] = None

class SocialPlan(BaseModel):
    plan_id: str
    user_id: str
    name: str
    description: Optional[str] = None
    price: float
    frequency: str
    networks: List[str] = ["instagram", "facebook"]
    created_at: datetime

class ProjectCreate(BaseModel):
    client_id: str
    name: str
    description: Optional[str] = None
    status: str = "new"
    social_networks: List[str] = []

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    social_networks: Optional[List[str]] = None

class ProjectStatusChange(BaseModel):
    status: str
    justification: str

class Project(BaseModel):
    project_id: str
    client_id: str
    user_id: str
    name: str
    description: Optional[str] = None
    status: str
    progress: int = 0
    social_networks: List[str] = []
    status_history: List[dict] = []
    created_at: datetime

# Status configuration with progress percentages
PROJECT_STATUSES = {
    "new": {"label": "Novo", "progress": 0, "color": "slate"},
    "analysis": {"label": "Em Análise", "progress": 20, "color": "blue"},
    "production": {"label": "Em Produção", "progress": 40, "color": "amber"},
    "review": {"label": "Em Revisão Final", "progress": 70, "color": "purple"},
    "completed": {"label": "Concluído", "progress": 100, "color": "emerald"},
    "cancelled": {"label": "Cancelado", "progress": 0, "color": "red"},
}

class SocialPostCreate(BaseModel):
    project_id: Optional[str] = None
    client_id: str
    plan_id: Optional[str] = None
    date: str
    time: Optional[str] = None
    network: str
    content: str
    status: str = "scheduled"  # scheduled, published, cancelled

class SocialPostUpdate(BaseModel):
    date: Optional[str] = None
    time: Optional[str] = None
    network: Optional[str] = None
    content: Optional[str] = None
    status: Optional[str] = None

class SocialPost(BaseModel):
    post_id: str
    project_id: Optional[str] = None
    client_id: str
    plan_id: Optional[str] = None
    user_id: str
    date: str
    time: Optional[str] = None
    network: str
    content: str
    status: str
    created_at: datetime

# Social post status configuration
POST_STATUSES = {
    "scheduled": {"label": "Agendado", "color": "blue"},
    "published": {"label": "Publicado", "color": "emerald"},
    "cancelled": {"label": "Cancelado", "color": "red"},
}

class GenerateMonthPosts(BaseModel):
    client_id: str
    plan_id: Optional[str] = None
    month: int
    year: int
    networks: List[str] = ["instagram", "facebook", "linkedin"]

class ContentPlanCreate(BaseModel):
    client_ids: List[str] = []
    month: int
    year: int
    title: str
    description: Optional[str] = None
    goals: Optional[List[str]] = None

class ContentPlanUpdate(BaseModel):
    client_ids: Optional[List[str]] = None
    title: Optional[str] = None
    description: Optional[str] = None
    goals: Optional[List[str]] = None

class ContentPlan(BaseModel):
    plan_id: str
    client_ids: List[str] = []
    user_id: str
    month: int
    year: int
    title: str
    description: Optional[str] = None
    goals: List[str] = []
    created_at: datetime

class NotificationCreate(BaseModel):
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    title: str
    message: str
    type: str = "info"
    send_email: bool = False

class Notification(BaseModel):
    notification_id: str
    user_id: str
    client_id: Optional[str] = None
    project_id: Optional[str] = None
    title: str
    message: str
    type: str
    read: bool = False
    created_at: datetime

class TicketCreate(BaseModel):
    subject: str
    message: str
    priority: str = "medium"

class TicketReply(BaseModel):
    message: str

class Ticket(BaseModel):
    ticket_id: str
    user_id: str
    subject: str
    status: str
    priority: str
    messages: List[dict]
    created_at: datetime
    updated_at: datetime

class ActivityLog(BaseModel):
    log_id: str
    user_id: str
    entity_type: str
    entity_id: str
    action: str
    details: Optional[str] = None
    created_at: datetime

# ==================== AUTH HELPERS ====================

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_jwt_token(user_id: str) -> str:
    payload = {
        "user_id": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        "iat": datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    # Check cookie first
    session_token = request.cookies.get("session_token")
    
    # Fall back to Authorization header
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header.split(" ")[1]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    # Check session in database (for Google auth)
    session_doc = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if session_doc:
        expires_at = session_doc.get("expires_at")
        if isinstance(expires_at, str):
            expires_at = datetime.fromisoformat(expires_at)
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="Session expired")
        
        user = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
        if user:
            return user
    
    # Try JWT token
    try:
        payload = jwt.decode(session_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if user:
            return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        pass
    
    raise HTTPException(status_code=401, detail="Invalid authentication")

async def log_activity(user_id: str, entity_type: str, entity_id: str, action: str, details: str = None):
    log_doc = {
        "log_id": f"log_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "entity_type": entity_type,
        "entity_id": entity_id,
        "action": action,
        "details": details,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.activity_logs.insert_one(log_doc)

async def send_notification_email(to_email: str, subject: str, message: str):
    if not resend.api_key or resend.api_key == 're_your_api_key_here':
        logger.warning("Resend API key not configured, skipping email")
        return None
    
    try:
        params = {
            "from": SENDER_EMAIL,
            "to": [to_email],
            "subject": subject,
            "html": f"<h2>{subject}</h2><p>{message}</p>"
        }
        email = await asyncio.to_thread(resend.Emails.send, params)
        return email.get("id")
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return None

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register")
async def register(user_data: UserCreate, response: Response):
    existing = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "password_hash": hash_password(user_data.password),
        "picture": None,
        "role": user_data.role,
        "associated_client_id": None,
        "admin_user_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    token = create_jwt_token(user_id)
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_HOURS * 3600
    )
    
    return {
        "user_id": user_id,
        "email": user_data.email,
        "name": user_data.name,
        "role": user_data.role,
        "token": token
    }

@api_router.post("/auth/login")
async def login(credentials: UserLogin, response: Response):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not user.get("password_hash") or not verify_password(credentials.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    token = create_jwt_token(user["user_id"])
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=JWT_EXPIRATION_HOURS * 3600
    )
    
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "role": user.get("role", "admin"),
        "associated_client_id": user.get("associated_client_id"),
        "token": token
    }

# Invite client user endpoint
@api_router.post("/auth/invite-client")
async def invite_client(invite_data: ClientInvite, user: dict = Depends(get_current_user)):
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite clients")
    
    # Check if client record exists
    client = await db.clients.find_one({"client_id": invite_data.associated_client_id, "user_id": user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Check if user already exists
    existing = await db.users.find_one({"email": invite_data.email}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Create client user with temporary password
    temp_password = uuid.uuid4().hex[:8]
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": invite_data.email,
        "name": invite_data.name,
        "password_hash": hash_password(temp_password),
        "picture": None,
        "role": "client",
        "associated_client_id": invite_data.associated_client_id,
        "admin_user_id": user["user_id"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Update client record with user_id
    await db.clients.update_one(
        {"client_id": invite_data.associated_client_id},
        {"$set": {"user_account_id": user_id}}
    )
    
    return {
        "user_id": user_id,
        "email": invite_data.email,
        "name": invite_data.name,
        "temp_password": temp_password,
        "message": "Client user created. Share the temporary password with the client."
    }

# REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
@api_router.post("/auth/google/session")
async def google_session(request: Request, response: Response):
    session_id = request.headers.get("X-Session-ID")
    if not session_id:
        raise HTTPException(status_code=400, detail="Session ID required")
    
    try:
        async with httpx.AsyncClient() as http_client:
            resp = await http_client.get(
                "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
                headers={"X-Session-ID": session_id}
            )
            if resp.status_code != 200:
                raise HTTPException(status_code=401, detail="Invalid session")
            
            data = resp.json()
    except httpx.RequestError as e:
        logger.error(f"Google auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication service error")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    existing = await db.users.find_one({"email": data["email"]}, {"_id": 0})
    
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": data["name"], "picture": data.get("picture")}}
        )
    else:
        user_doc = {
            "user_id": user_id,
            "email": data["email"],
            "name": data["name"],
            "picture": data.get("picture"),
            "password_hash": None,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    session_token = data.get("session_token", create_jwt_token(user_id))
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.user_sessions.delete_many({"user_id": user_id})
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 3600
    )
    
    return {
        "user_id": user_id,
        "email": data["email"],
        "name": data["name"],
        "picture": data.get("picture"),
        "token": session_token
    }

@api_router.get("/auth/me")
async def get_me(user: dict = Depends(get_current_user)):
    return {
        "user_id": user["user_id"],
        "email": user["email"],
        "name": user["name"],
        "picture": user.get("picture"),
        "role": user.get("role", "admin"),
        "associated_client_id": user.get("associated_client_id")
    }

@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_many({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/", secure=True, samesite="none")
    return {"message": "Logged out"}

# ==================== SERVICES ENDPOINTS ====================

@api_router.post("/services", response_model=Service)
async def create_service(service_data: ServiceCreate, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot create services")
    
    service_id = f"svc_{uuid.uuid4().hex[:12]}"
    service_doc = {
        "service_id": service_id,
        "user_id": user["user_id"],
        "name": service_data.name,
        "description": service_data.description,
        "price": service_data.price,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.services.insert_one(service_doc)
    await log_activity(user["user_id"], "service", service_id, "created", f"Created service: {service_data.name}")
    
    service_doc.pop("_id", None)
    service_doc["created_at"] = datetime.fromisoformat(service_doc["created_at"])
    return service_doc

@api_router.get("/services")
async def list_services(user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        return []
    services = await db.services.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    for s in services:
        if isinstance(s.get("created_at"), str):
            s["created_at"] = datetime.fromisoformat(s["created_at"])
    return services

@api_router.get("/services/{service_id}")
async def get_service(service_id: str, user: dict = Depends(get_current_user)):
    service = await db.services.find_one({"service_id": service_id, "user_id": user["user_id"]}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    if isinstance(service.get("created_at"), str):
        service["created_at"] = datetime.fromisoformat(service["created_at"])
    return service

@api_router.put("/services/{service_id}")
async def update_service(service_id: str, service_data: ServiceUpdate, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot update services")
    
    service = await db.services.find_one({"service_id": service_id, "user_id": user["user_id"]}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    update_data = {k: v for k, v in service_data.model_dump().items() if v is not None}
    if update_data:
        await db.services.update_one({"service_id": service_id}, {"$set": update_data})
        await log_activity(user["user_id"], "service", service_id, "updated", f"Updated: {', '.join(update_data.keys())}")
    
    updated = await db.services.find_one({"service_id": service_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return updated

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot delete services")
    
    result = await db.services.delete_one({"service_id": service_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    await log_activity(user["user_id"], "service", service_id, "deleted", "Service deleted")
    return {"message": "Service deleted"}

@api_router.get("/posting-frequencies")
async def get_posting_frequencies():
    return POSTING_FREQUENCIES

# ==================== SOCIAL PLANS ENDPOINTS ====================

@api_router.post("/social-plans", response_model=SocialPlan)
async def create_social_plan(plan_data: SocialPlanCreate, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot create plans")
    
    # Validate frequency
    if plan_data.frequency not in POSTING_FREQUENCIES:
        raise HTTPException(status_code=400, detail="Invalid frequency")
    
    plan_id = f"plan_{uuid.uuid4().hex[:12]}"
    plan_doc = {
        "plan_id": plan_id,
        "user_id": user["user_id"],
        "name": plan_data.name,
        "description": plan_data.description,
        "price": plan_data.price,
        "frequency": plan_data.frequency,
        "networks": ["instagram", "facebook"],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.social_plans.insert_one(plan_doc)
    await log_activity(user["user_id"], "social_plan", plan_id, "created", f"Created plan: {plan_data.name}")
    
    plan_doc.pop("_id", None)
    plan_doc["created_at"] = datetime.fromisoformat(plan_doc["created_at"])
    return plan_doc

@api_router.get("/social-plans")
async def list_social_plans(user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        return []
    plans = await db.social_plans.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    for p in plans:
        if isinstance(p.get("created_at"), str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
    return plans

@api_router.get("/social-plans/{plan_id}")
async def get_social_plan(plan_id: str, user: dict = Depends(get_current_user)):
    plan = await db.social_plans.find_one({"plan_id": plan_id, "user_id": user["user_id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if isinstance(plan.get("created_at"), str):
        plan["created_at"] = datetime.fromisoformat(plan["created_at"])
    return plan

@api_router.put("/social-plans/{plan_id}")
async def update_social_plan(plan_id: str, plan_data: SocialPlanUpdate, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot update plans")
    
    plan = await db.social_plans.find_one({"plan_id": plan_id, "user_id": user["user_id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    update_data = {k: v for k, v in plan_data.model_dump().items() if v is not None}
    
    # Validate frequency if provided
    if "frequency" in update_data and update_data["frequency"] not in POSTING_FREQUENCIES:
        raise HTTPException(status_code=400, detail="Invalid frequency")
    
    if update_data:
        await db.social_plans.update_one({"plan_id": plan_id}, {"$set": update_data})
        await log_activity(user["user_id"], "social_plan", plan_id, "updated", f"Updated: {', '.join(update_data.keys())}")
    
    updated = await db.social_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return updated

@api_router.delete("/social-plans/{plan_id}")
async def delete_social_plan(plan_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot delete plans")
    
    result = await db.social_plans.delete_one({"plan_id": plan_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    await log_activity(user["user_id"], "social_plan", plan_id, "deleted", "Plan deleted")
    return {"message": "Plan deleted"}

# ==================== CLIENTS ENDPOINTS ====================

@api_router.post("/clients", response_model=Client)
async def create_client(client_data: ClientCreate, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot create clients")
    
    client_id = f"client_{uuid.uuid4().hex[:12]}"
    client_doc = {
        "client_id": client_id,
        "user_id": user["user_id"],
        "name": client_data.name,
        "email": client_data.email,
        "company": client_data.company,
        "phone": client_data.phone,
        "notes": client_data.notes,
        "posting_frequency": client_data.posting_frequency,
        "service_ids": client_data.service_ids,
        "plan_id": client_data.plan_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.clients.insert_one(client_doc)
    await log_activity(user["user_id"], "client", client_id, "created", f"Created client: {client_data.name}")
    
    client_doc.pop("_id", None)
    client_doc["created_at"] = datetime.fromisoformat(client_doc["created_at"])
    return client_doc

@api_router.get("/clients")
async def list_clients(user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        return []
    clients = await db.clients.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(1000)
    for c in clients:
        if isinstance(c.get("created_at"), str):
            c["created_at"] = datetime.fromisoformat(c["created_at"])
        # Ensure new fields exist
        if "posting_frequency" not in c:
            c["posting_frequency"] = "3_per_week"
        if "service_ids" not in c:
            c["service_ids"] = []
    return clients

@api_router.get("/clients/{client_id}")
async def get_client(client_id: str, user: dict = Depends(get_current_user)):
    client = await db.clients.find_one({"client_id": client_id, "user_id": user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if isinstance(client.get("created_at"), str):
        client["created_at"] = datetime.fromisoformat(client["created_at"])
    return client

@api_router.put("/clients/{client_id}")
async def update_client(client_id: str, client_data: ClientUpdate, user: dict = Depends(get_current_user)):
    client = await db.clients.find_one({"client_id": client_id, "user_id": user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    update_data = {k: v for k, v in client_data.model_dump().items() if v is not None}
    if update_data:
        await db.clients.update_one({"client_id": client_id}, {"$set": update_data})
        await log_activity(user["user_id"], "client", client_id, "updated", f"Updated: {', '.join(update_data.keys())}")
    
    updated = await db.clients.find_one({"client_id": client_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return updated

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, user: dict = Depends(get_current_user)):
    result = await db.clients.delete_one({"client_id": client_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Client not found")
    await log_activity(user["user_id"], "client", client_id, "deleted", "Client deleted")
    return {"message": "Client deleted"}

# ==================== PROJECTS ENDPOINTS ====================

@api_router.get("/project-statuses")
async def get_project_statuses():
    """Return available project statuses with their configurations"""
    return PROJECT_STATUSES

@api_router.post("/projects", response_model=Project)
async def create_project(project_data: ProjectCreate, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot create projects")
    
    client = await db.clients.find_one({"client_id": project_data.client_id, "user_id": user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    status = project_data.status if project_data.status in PROJECT_STATUSES else "new"
    progress = PROJECT_STATUSES[status]["progress"]
    
    project_id = f"proj_{uuid.uuid4().hex[:12]}"
    project_doc = {
        "project_id": project_id,
        "client_id": project_data.client_id,
        "user_id": user["user_id"],
        "name": project_data.name,
        "description": project_data.description,
        "status": status,
        "progress": progress,
        "social_networks": project_data.social_networks,
        "status_history": [{
            "status": status,
            "progress": progress,
            "changed_by": user["user_id"],
            "changed_by_name": user["name"],
            "justification": "Projeto criado",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.projects.insert_one(project_doc)
    await log_activity(user["user_id"], "project", project_id, "created", f"Created project: {project_data.name}")
    
    project_doc.pop("_id", None)
    project_doc["created_at"] = datetime.fromisoformat(project_doc["created_at"])
    return project_doc

@api_router.get("/projects")
async def list_projects(client_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        # Client can only see projects associated with their client record
        associated_client_id = user.get("associated_client_id")
        if not associated_client_id:
            return []
        query = {"client_id": associated_client_id}
    else:
        query = {"user_id": user["user_id"]}
        if client_id:
            query["client_id"] = client_id
    
    projects = await db.projects.find(query, {"_id": 0}).to_list(1000)
    for p in projects:
        if isinstance(p.get("created_at"), str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
        # Ensure progress field exists
        if "progress" not in p:
            p["progress"] = PROJECT_STATUSES.get(p.get("status", "new"), {}).get("progress", 0)
        if "status_history" not in p:
            p["status_history"] = []
    return projects

@api_router.get("/projects/{project_id}")
async def get_project(project_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        associated_client_id = user.get("associated_client_id")
        project = await db.projects.find_one({"project_id": project_id, "client_id": associated_client_id}, {"_id": 0})
    else:
        project = await db.projects.find_one({"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if isinstance(project.get("created_at"), str):
        project["created_at"] = datetime.fromisoformat(project["created_at"])
    if "progress" not in project:
        project["progress"] = PROJECT_STATUSES.get(project.get("status", "new"), {}).get("progress", 0)
    if "status_history" not in project:
        project["status_history"] = []
    return project

@api_router.put("/projects/{project_id}")
async def update_project(project_id: str, project_data: ProjectUpdate, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot update projects directly. Use status change endpoint.")
    
    project = await db.projects.find_one({"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    update_data = {k: v for k, v in project_data.model_dump().items() if v is not None}
    old_status = project.get("status")
    
    # Update progress if status changed
    if "status" in update_data and update_data["status"] in PROJECT_STATUSES:
        update_data["progress"] = PROJECT_STATUSES[update_data["status"]]["progress"]
    
    if update_data:
        await db.projects.update_one({"project_id": project_id}, {"$set": update_data})
        await log_activity(user["user_id"], "project", project_id, "updated", f"Updated: {', '.join(update_data.keys())}")
        
        # Create notification if status changed
        if "status" in update_data and update_data["status"] != old_status:
            # Add to status history
            history_entry = {
                "status": update_data["status"],
                "progress": update_data.get("progress", 0),
                "changed_by": user["user_id"],
                "changed_by_name": user["name"],
                "justification": "Atualizado pelo admin",
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            await db.projects.update_one(
                {"project_id": project_id},
                {"$push": {"status_history": history_entry}}
            )
            
            notif_doc = {
                "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
                "user_id": user["user_id"],
                "client_id": project["client_id"],
                "project_id": project_id,
                "title": "Estado do projeto atualizado",
                "message": f"O projeto '{project['name']}' mudou de '{old_status}' para '{update_data['status']}'",
                "type": "status_change",
                "read": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.notifications.insert_one(notif_doc)
    
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return updated

# Client status change endpoint with justification
@api_router.post("/projects/{project_id}/status")
async def change_project_status(project_id: str, status_change: ProjectStatusChange, user: dict = Depends(get_current_user)):
    """Change project status - clients must provide justification"""
    
    if user.get("role") == "client":
        associated_client_id = user.get("associated_client_id")
        project = await db.projects.find_one({"project_id": project_id, "client_id": associated_client_id}, {"_id": 0})
    else:
        project = await db.projects.find_one({"project_id": project_id, "user_id": user["user_id"]}, {"_id": 0})
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if status_change.status not in PROJECT_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")
    
    if not status_change.justification.strip():
        raise HTTPException(status_code=400, detail="Justification is required")
    
    old_status = project.get("status")
    new_progress = PROJECT_STATUSES[status_change.status]["progress"]
    
    # Add to status history
    history_entry = {
        "status": status_change.status,
        "progress": new_progress,
        "changed_by": user["user_id"],
        "changed_by_name": user["name"],
        "changed_by_role": user.get("role", "admin"),
        "justification": status_change.justification,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.update_one(
        {"project_id": project_id},
        {
            "$set": {"status": status_change.status, "progress": new_progress},
            "$push": {"status_history": history_entry}
        }
    )
    
    await log_activity(
        user["user_id"], "project", project_id, "status_changed",
        f"Status changed from '{old_status}' to '{status_change.status}': {status_change.justification}"
    )
    
    # Create notification
    notif_doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "user_id": project.get("user_id"),
        "client_id": project["client_id"],
        "project_id": project_id,
        "title": "Estado do projeto alterado",
        "message": f"O projeto '{project['name']}' foi alterado de '{old_status}' para '{status_change.status}'. Justificação: {status_change.justification}",
        "type": "status_change",
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif_doc)
    
    updated = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return updated

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot delete projects")
    
    result = await db.projects.delete_one({"project_id": project_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    await log_activity(user["user_id"], "project", project_id, "deleted", "Project deleted")
    return {"message": "Project deleted"}

# ==================== SOCIAL POSTS ENDPOINTS ====================

@api_router.get("/post-statuses")
async def get_post_statuses():
    """Return available post statuses"""
    return POST_STATUSES

@api_router.post("/social-posts", response_model=SocialPost)
async def create_social_post(post_data: SocialPostCreate, user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot create posts")
    
    # Verify client exists
    client = await db.clients.find_one({"client_id": post_data.client_id, "user_id": user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    post_id = f"post_{uuid.uuid4().hex[:12]}"
    post_doc = {
        "post_id": post_id,
        "project_id": post_data.project_id,
        "client_id": post_data.client_id,
        "plan_id": post_data.plan_id,
        "user_id": user["user_id"],
        "date": post_data.date,
        "time": post_data.time,
        "network": post_data.network,
        "content": post_data.content,
        "status": post_data.status,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.social_posts.insert_one(post_doc)
    await log_activity(user["user_id"], "social_post", post_id, "created", f"Created post for {post_data.network}")
    
    post_doc.pop("_id", None)
    post_doc["created_at"] = datetime.fromisoformat(post_doc["created_at"])
    return post_doc

@api_router.post("/social-posts/generate-month")
async def generate_month_posts(data: GenerateMonthPosts, user: dict = Depends(get_current_user)):
    """Generate posts for a month based on client's plan frequency"""
    if user.get("role") == "client":
        raise HTTPException(status_code=403, detail="Clients cannot generate posts")
    
    # Verify client exists
    client = await db.clients.find_one({"client_id": data.client_id, "user_id": user["user_id"]}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get frequency from plan if client has one, otherwise use client's posting_frequency
    frequency = "3_per_week"  # default
    plan_name = None
    
    client_plan_id = client.get("plan_id")
    if client_plan_id:
        plan = await db.social_plans.find_one({"plan_id": client_plan_id, "user_id": user["user_id"]}, {"_id": 0})
        if plan:
            frequency = plan.get("frequency", "3_per_week")
            plan_name = plan.get("name")
    else:
        # Fallback to client's posting_frequency if no plan
        frequency = client.get("posting_frequency", "3_per_week")
    
    freq_config = POSTING_FREQUENCIES.get(frequency, POSTING_FREQUENCIES["3_per_week"])
    
    # Calculate posting days based on frequency
    import calendar
    from datetime import date as date_type
    
    first_day = date_type(data.year, data.month, 1)
    num_days = calendar.monthrange(data.year, data.month)[1]
    
    # Determine which days to post based on frequency
    posting_days = []
    if frequency == "daily":
        posting_days = list(range(1, num_days + 1))
    elif frequency == "5_per_week":
        # Monday to Friday
        for day in range(1, num_days + 1):
            d = date_type(data.year, data.month, day)
            if d.weekday() < 5:  # Monday=0, Friday=4
                posting_days.append(day)
    elif frequency == "4_per_week":
        # Monday, Tuesday, Thursday, Friday
        for day in range(1, num_days + 1):
            d = date_type(data.year, data.month, day)
            if d.weekday() in [0, 1, 3, 4]:  # Monday, Tuesday, Thursday, Friday
                posting_days.append(day)
    elif frequency == "3_per_week":
        # Monday, Wednesday, Friday
        for day in range(1, num_days + 1):
            d = date_type(data.year, data.month, day)
            if d.weekday() in [0, 2, 4]:  # Monday, Wednesday, Friday
                posting_days.append(day)
    elif frequency == "2_per_week":
        # Tuesday, Thursday
        for day in range(1, num_days + 1):
            d = date_type(data.year, data.month, day)
            if d.weekday() in [1, 3]:  # Tuesday, Thursday
                posting_days.append(day)
    elif frequency == "1_per_week":
        # Every Monday
        for day in range(1, num_days + 1):
            d = date_type(data.year, data.month, day)
            if d.weekday() == 0:  # Monday
                posting_days.append(day)
    
    # Delete existing posts for this month/client if any
    await db.social_posts.delete_many({
        "user_id": user["user_id"],
        "client_id": data.client_id,
        "date": {"$regex": f"^{data.year}-{data.month:02d}"}
    })
    
    # Create posts
    created_posts = []
    for day in posting_days:
        for network in data.networks:
            post_id = f"post_{uuid.uuid4().hex[:12]}"
            post_doc = {
                "post_id": post_id,
                "project_id": None,
                "client_id": data.client_id,
                "plan_id": data.plan_id,
                "user_id": user["user_id"],
                "date": f"{data.year}-{data.month:02d}-{day:02d}",
                "time": "10:00",
                "network": network,
                "content": "",
                "status": "scheduled",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.social_posts.insert_one(post_doc)
            created_posts.append(post_doc)
    
    await log_activity(user["user_id"], "social_post", "", "generated", 
                      f"Generated {len(created_posts)} posts for {client['name']} - {data.month}/{data.year}")
    
    return {
        "message": f"Generated {len(created_posts)} posts",
        "posts_count": len(created_posts),
        "client": client["name"],
        "frequency": freq_config["label"],
        "posting_days": len(posting_days)
    }

@api_router.get("/social-posts")
async def list_social_posts(client_id: Optional[str] = None, project_id: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if client_id:
        query["client_id"] = client_id
    if project_id:
        query["project_id"] = project_id
    
    posts = await db.social_posts.find(query, {"_id": 0}).to_list(1000)
    
    # Filter by month/year if provided
    if month and year:
        filtered = []
        for p in posts:
            try:
                post_date = datetime.strptime(p["date"], "%Y-%m-%d")
                if post_date.month == month and post_date.year == year:
                    filtered.append(p)
            except:
                filtered.append(p)
        posts = filtered
    
    for p in posts:
        if isinstance(p.get("created_at"), str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
    return posts

@api_router.get("/social-posts/{post_id}")
async def get_social_post(post_id: str, user: dict = Depends(get_current_user)):
    post = await db.social_posts.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if isinstance(post.get("created_at"), str):
        post["created_at"] = datetime.fromisoformat(post["created_at"])
    return post

@api_router.put("/social-posts/{post_id}")
async def update_social_post(post_id: str, post_data: SocialPostUpdate, user: dict = Depends(get_current_user)):
    post = await db.social_posts.find_one({"post_id": post_id, "user_id": user["user_id"]}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    update_data = {k: v for k, v in post_data.model_dump().items() if v is not None}
    if update_data:
        await db.social_posts.update_one({"post_id": post_id}, {"$set": update_data})
        await log_activity(user["user_id"], "social_post", post_id, "updated", f"Updated: {', '.join(update_data.keys())}")
    
    updated = await db.social_posts.find_one({"post_id": post_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    return updated

@api_router.delete("/social-posts/{post_id}")
async def delete_social_post(post_id: str, user: dict = Depends(get_current_user)):
    result = await db.social_posts.delete_one({"post_id": post_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Post not found")
    await log_activity(user["user_id"], "social_post", post_id, "deleted", "Post deleted")
    return {"message": "Post deleted"}

# ==================== CONTENT PLANS ENDPOINTS ====================

@api_router.post("/content-plans", response_model=ContentPlan)
async def create_content_plan(plan_data: ContentPlanCreate, user: dict = Depends(get_current_user)):
    # Verify all clients exist
    for client_id in plan_data.client_ids:
        client = await db.clients.find_one({"client_id": client_id, "user_id": user["user_id"]}, {"_id": 0})
        if not client:
            raise HTTPException(status_code=404, detail=f"Client {client_id} not found")
    
    plan_id = f"plan_{uuid.uuid4().hex[:12]}"
    plan_doc = {
        "plan_id": plan_id,
        "client_ids": plan_data.client_ids,
        "user_id": user["user_id"],
        "month": plan_data.month,
        "year": plan_data.year,
        "title": plan_data.title,
        "description": plan_data.description,
        "goals": plan_data.goals or [],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.content_plans.insert_one(plan_doc)
    await log_activity(user["user_id"], "content_plan", plan_id, "created", f"Created plan: {plan_data.title}")
    
    plan_doc.pop("_id", None)
    plan_doc["created_at"] = datetime.fromisoformat(plan_doc["created_at"])
    return plan_doc

@api_router.get("/content-plans")
async def list_content_plans(client_id: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if client_id:
        query["client_ids"] = client_id
    plans = await db.content_plans.find(query, {"_id": 0}).to_list(1000)
    for p in plans:
        if isinstance(p.get("created_at"), str):
            p["created_at"] = datetime.fromisoformat(p["created_at"])
        # Ensure client_ids exists for backwards compatibility
        if "client_ids" not in p:
            p["client_ids"] = []
    return plans

@api_router.get("/content-plans/{plan_id}")
async def get_content_plan(plan_id: str, user: dict = Depends(get_current_user)):
    plan = await db.content_plans.find_one({"plan_id": plan_id, "user_id": user["user_id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    if isinstance(plan.get("created_at"), str):
        plan["created_at"] = datetime.fromisoformat(plan["created_at"])
    if "client_ids" not in plan:
        plan["client_ids"] = []
    return plan

@api_router.put("/content-plans/{plan_id}")
async def update_content_plan(plan_id: str, plan_data: ContentPlanUpdate, user: dict = Depends(get_current_user)):
    plan = await db.content_plans.find_one({"plan_id": plan_id, "user_id": user["user_id"]}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    
    update_data = {k: v for k, v in plan_data.model_dump().items() if v is not None}
    
    # Verify new clients exist if updating client_ids
    if "client_ids" in update_data:
        for client_id in update_data["client_ids"]:
            client = await db.clients.find_one({"client_id": client_id, "user_id": user["user_id"]}, {"_id": 0})
            if not client:
                raise HTTPException(status_code=404, detail=f"Client {client_id} not found")
    
    if update_data:
        await db.content_plans.update_one({"plan_id": plan_id}, {"$set": update_data})
        await log_activity(user["user_id"], "content_plan", plan_id, "updated", f"Updated: {', '.join(update_data.keys())}")
    
    updated = await db.content_plans.find_one({"plan_id": plan_id}, {"_id": 0})
    if isinstance(updated.get("created_at"), str):
        updated["created_at"] = datetime.fromisoformat(updated["created_at"])
    if "client_ids" not in updated:
        updated["client_ids"] = []
    return updated

@api_router.delete("/content-plans/{plan_id}")
async def delete_content_plan(plan_id: str, user: dict = Depends(get_current_user)):
    result = await db.content_plans.delete_one({"plan_id": plan_id, "user_id": user["user_id"]})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Plan not found")
    await log_activity(user["user_id"], "content_plan", plan_id, "deleted", "Plan deleted")
    return {"message": "Plan deleted"}

# ==================== NOTIFICATIONS ENDPOINTS ====================

@api_router.post("/notifications")
async def create_notification(notif_data: NotificationCreate, user: dict = Depends(get_current_user)):
    notif_id = f"notif_{uuid.uuid4().hex[:12]}"
    notif_doc = {
        "notification_id": notif_id,
        "user_id": user["user_id"],
        "client_id": notif_data.client_id,
        "project_id": notif_data.project_id,
        "title": notif_data.title,
        "message": notif_data.message,
        "type": notif_data.type,
        "read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notif_doc)
    
    # Send email if requested
    if notif_data.send_email and notif_data.client_id:
        client = await db.clients.find_one({"client_id": notif_data.client_id}, {"_id": 0})
        if client and client.get("email"):
            await send_notification_email(client["email"], notif_data.title, notif_data.message)
    
    notif_doc.pop("_id", None)
    return notif_doc

@api_router.get("/notifications")
async def list_notifications(unread_only: bool = False, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if unread_only:
        query["read"] = False
    notifications = await db.notifications.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: dict = Depends(get_current_user)):
    result = await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user["user_id"]},
        {"$set": {"read": True}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    return {"message": "Marked as read"}

@api_router.put("/notifications/mark-all-read")
async def mark_all_notifications_read(user: dict = Depends(get_current_user)):
    await db.notifications.update_many(
        {"user_id": user["user_id"], "read": False},
        {"$set": {"read": True}}
    )
    return {"message": "All notifications marked as read"}

# ==================== TICKETS ENDPOINTS ====================

@api_router.post("/tickets")
async def create_ticket(ticket_data: TicketCreate, user: dict = Depends(get_current_user)):
    ticket_id = f"ticket_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()
    ticket_doc = {
        "ticket_id": ticket_id,
        "user_id": user["user_id"],
        "subject": ticket_data.subject,
        "status": "open",
        "priority": ticket_data.priority,
        "messages": [{
            "message_id": f"msg_{uuid.uuid4().hex[:8]}",
            "sender": "user",
            "sender_name": user["name"],
            "message": ticket_data.message,
            "created_at": now
        }],
        "created_at": now,
        "updated_at": now
    }
    await db.tickets.insert_one(ticket_doc)
    await log_activity(user["user_id"], "ticket", ticket_id, "created", f"Created ticket: {ticket_data.subject}")
    
    ticket_doc.pop("_id", None)
    return ticket_doc

@api_router.get("/tickets")
async def list_tickets(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if status:
        query["status"] = status
    tickets = await db.tickets.find(query, {"_id": 0}).sort("updated_at", -1).to_list(100)
    return tickets

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"ticket_id": ticket_id, "user_id": user["user_id"]}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    return ticket

@api_router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(ticket_id: str, reply_data: TicketReply, user: dict = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"ticket_id": ticket_id, "user_id": user["user_id"]}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    now = datetime.now(timezone.utc).isoformat()
    new_message = {
        "message_id": f"msg_{uuid.uuid4().hex[:8]}",
        "sender": "user",
        "sender_name": user["name"],
        "message": reply_data.message,
        "created_at": now
    }
    
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$push": {"messages": new_message}, "$set": {"updated_at": now}}
    )
    await log_activity(user["user_id"], "ticket", ticket_id, "replied", "Added reply to ticket")
    
    updated = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    return updated

@api_router.put("/tickets/{ticket_id}/close")
async def close_ticket(ticket_id: str, user: dict = Depends(get_current_user)):
    result = await db.tickets.update_one(
        {"ticket_id": ticket_id, "user_id": user["user_id"]},
        {"$set": {"status": "closed", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await log_activity(user["user_id"], "ticket", ticket_id, "closed", "Ticket closed")
    return {"message": "Ticket closed"}

# ==================== ACTIVITY LOG ENDPOINTS ====================

@api_router.get("/activity-logs")
async def list_activity_logs(entity_type: Optional[str] = None, entity_id: Optional[str] = None, limit: int = 50, user: dict = Depends(get_current_user)):
    query = {"user_id": user["user_id"]}
    if entity_type:
        query["entity_type"] = entity_type
    if entity_id:
        query["entity_id"] = entity_id
    
    logs = await db.activity_logs.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return logs

# ==================== DASHBOARD STATS ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(user: dict = Depends(get_current_user)):
    if user.get("role") == "client":
        # Client dashboard - only show their projects
        associated_client_id = user.get("associated_client_id")
        if not associated_client_id:
            return {
                "clients_count": 0,
                "projects_count": 0,
                "active_projects": 0,
                "posts_count": 0,
                "pending_posts": 0,
                "open_tickets": 0,
                "unread_notifications": 0,
                "posts_by_network": {},
                "recent_activity": []
            }
        
        projects_count = await db.projects.count_documents({"client_id": associated_client_id})
        # Count non-completed projects as active
        active_projects = await db.projects.count_documents({
            "client_id": associated_client_id, 
            "status": {"$nin": ["completed"]}
        })
        open_tickets = await db.tickets.count_documents({"user_id": user["user_id"], "status": "open"})
        unread_notifications = await db.notifications.count_documents({
            "$or": [
                {"user_id": user["user_id"], "read": False},
                {"client_id": associated_client_id, "read": False}
            ]
        })
        
        # Get project status breakdown for client
        projects = await db.projects.find({"client_id": associated_client_id}, {"_id": 0}).to_list(100)
        status_breakdown = {}
        for p in projects:
            status = p.get("status", "new")
            status_breakdown[status] = status_breakdown.get(status, 0) + 1
        
        return {
            "clients_count": 0,
            "projects_count": projects_count,
            "active_projects": active_projects,
            "posts_count": 0,
            "pending_posts": 0,
            "open_tickets": open_tickets,
            "unread_notifications": unread_notifications,
            "posts_by_network": {},
            "status_breakdown": status_breakdown,
            "recent_activity": []
        }
    
    # Admin dashboard
    clients_count = await db.clients.count_documents({"user_id": user["user_id"]})
    projects_count = await db.projects.count_documents({"user_id": user["user_id"]})
    active_projects = await db.projects.count_documents({"user_id": user["user_id"], "status": {"$nin": ["completed"]}})
    posts_count = await db.social_posts.count_documents({"user_id": user["user_id"]})
    pending_posts = await db.social_posts.count_documents({"user_id": user["user_id"], "status": "draft"})
    open_tickets = await db.tickets.count_documents({"user_id": user["user_id"], "status": "open"})
    unread_notifications = await db.notifications.count_documents({"user_id": user["user_id"], "read": False})
    
    # Recent activity
    recent_logs = await db.activity_logs.find(
        {"user_id": user["user_id"]}, {"_id": 0}
    ).sort("created_at", -1).to_list(10)
    
    # Posts by network
    posts_by_network = {}
    posts = await db.social_posts.find({"user_id": user["user_id"]}, {"_id": 0, "network": 1}).to_list(1000)
    for p in posts:
        network = p.get("network", "other")
        posts_by_network[network] = posts_by_network.get(network, 0) + 1
    
    return {
        "clients_count": clients_count,
        "projects_count": projects_count,
        "active_projects": active_projects,
        "posts_count": posts_count,
        "pending_posts": pending_posts,
        "open_tickets": open_tickets,
        "unread_notifications": unread_notifications,
        "posts_by_network": posts_by_network,
        "recent_activity": recent_logs
    }

# ==================== STATUS ENDPOINTS ====================

@api_router.get("/")
async def root():
    return {"message": "Client Portal API", "status": "healthy"}

@api_router.get("/health")
async def health():
    return {"status": "healthy"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[
        "http://localhost:3000",
        "https://contentmanager-3.preview.emergentagent.com",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

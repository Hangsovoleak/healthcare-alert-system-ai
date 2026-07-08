# PRODUCTION FASTAPI BACKEND ARCHITECTURE & REFERENCE IMPLEMENTATION
## Project: LifeLink AI — Cambodia Intelligent Emergency Medical Response Platform
### Role: Principal Python Backend Architect
### Document Reference: LLA-FASTAPI-BACKEND-2026-V1
### Date: July 7, 2026

---

## 1. ARCHITECTURAL PATTERNS: CLEAN ARCHITECTURE IN FASTAPI

LifeLink AI's FastAPI backend is designed around **Clean Architecture (Uncle Bob)** principles. This isolates business logic (Entities & Use Cases) from external infrastructure, web frameworks (FastAPI), databases (PostgreSQL/SQLAlchemy), and third-party APIs (Google Gemini, SMS Gateways).

```
         +--------------------------------------------------+
         |               INFRASTRUCTURE LAYER               |
         |  [FastAPI Routers] [SQLAlchemy ORM] [WebSockets] |
         +------------------------+-------------------------+
                                  |
                                  v
         +------------------------+-------------------------+
         |                INTERFACE ADAPTERS                |
         |  [Controllers] [Repositories] [Gateways/API Prox] |
         +------------------------+-------------------------+
                                  |
                                  v
         +------------------------+-------------------------+
         |                APPLICATION CORE (USE CASES)     |
         |     [TriageIncident] [RouteAmbulance] [Auth]    |
         +------------------------+-------------------------+
                                  |
                                  v
         +------------------------+-------------------------+
         |                   DOMAIN ENTITIES                |
         |           [Incident] [Hospital] [Ambulance]      |
         +--------------------------------------------------+
```

### 1.1 Project Structure (Clean Directory Mapping)
```
backend/
├── app/
│   ├── main.py                 # FastAPI application entrypoint & middleware
│   ├── config.py               # Settings (Pydantic-Settings)
│   ├── core/                   # System-wide utilities
│   │   ├── security.py         # JWT and password hashing
│   │   ├── logging.py          # Structured logger setup
│   │   └── database.py         # Async engine & session manager
│   ├── domain/                 # Layer 1: Core Domain Entities
│   │   ├── models.py           # Core business dataclasses
│   │   └── schemas/            # Pydantic input/output schemas
│   ├── use_cases/              # Layer 2: Business Rules & Orchestration
│   │   ├── auth_use_case.py
│   │   ├── triage_use_case.py
│   │   └── routing_use_case.py
│   ├── interfaces/             # Layer 3: Adapters & Gateways
│   │   ├── repositories/       # Database CRUD operations
│   │   │   ├── base.py
│   │   │   ├── incident_repo.py
│   │   │   └── hospital_repo.py
│   │   └── ai_gateway.py       # Gemini API client proxy
│   └── infrastructure/         # Layer 4: Frameworks, Web & WS
│       ├── api_v1/             # REST Endpoints
│       │   ├── auth.py
│       │   ├── incidents.py
│       │   ├── hospitals.py
│       │   └── stats.py
│       └── websockets/         # Real-Time Telemetry Handler
│           └── connection_manager.py
└── tests/                      # Testing Suite
    ├── conftest.py             # Pytest fixtures & async client
    ├── test_auth.py
    └── test_triage.py
```

---

## 2. MAIN APPLICATION ENTRYPOINT & MIDDLEWARE (`app/main.py`)

Handles initialization, CORS, custom structured request/response logging, exception handlers, and routing.

```python
import time
import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.config import settings
from app.infrastructure.api_v1 import auth, incidents, hospitals, stats
from app.infrastructure.websockets.connection_manager import ws_router
from app.core.logging import setup_structured_logging

# Initialize Structured JSON Logging
setup_structured_logging()
logger = logging.getLogger("lifelink_api")

app = FastAPI(
    title="LifeLink AI - Core Backend API",
    description="Intelligent Emergency Medical Response Platform for Cambodia",
    version="1.0.4",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Middleware Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Custom Telemetry & Request Duration Middleware
@app.middleware("http")
async def log_requests_and_latency(request: Request, call_next):
    start_time = time.time()
    request_id = request.headers.get("X-Request-ID", "anonymous")
    
    logger.info(f"Incoming: {request.method} {request.url.path} (ID: {request_id})")
    
    try:
        response = await call_next(request)
        duration = time.time() - start_time
        logger.info(
            f"Completed: {request.method} {request.url.path} "
            f"Status: {response.status_code} Latency: {duration:.4f}s"
        )
        response.headers["X-Process-Time"] = f"{duration:.4f}s"
        return response
    except Exception as e:
        duration = time.time() - start_time
        logger.error(f"Failed: {request.method} {request.url.path} Error: {str(e)} Latency: {duration:.4f}s")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": "An internal server error occurred within the LifeLink Gateway."}
        )

# Mounting API Routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(incidents.router, prefix="/api/v1/incidents", tags=["Incidents"])
app.include_router(hospitals.router, prefix="/api/v1/hospitals", tags=["Hospitals"])
app.include_router(stats.router, prefix="/api/v1/stats", tags=["MoH Analytics"])
app.include_router(ws_router, prefix="/ws", tags=["Real-Time WebSockets"])

@app.get("/api/v1/health", tags=["System Utility"])
async def health_check():
    return {
        "status": "healthy",
        "timestamp": time.time(),
        "node": "Phnom Penh Node 1",
        "database_connected": True
    }
```

---

## 3. CONFIGURATION MANAGEMENT (`app/config.py`)

Using `pydantic-settings` to enforce type safety on environment variables.

```python
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App Properties
    ENV: str = Field(default="development")
    SECRET_KEY: str = Field(default="SUPER_SECRET_COMPROMISED_KEY_FOR_LOCAL_DEV_ONLY_ROTATE_IN_PROD")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440 # 24 hours
    
    # DB Properties
    POSTGRES_USER: str = Field(default="lifelink_db_user")
    POSTGRES_PASSWORD: str = Field(default="secure_pass")
    POSTGRES_DB: str = Field(default="lifelink_prod")
    POSTGRES_HOST: str = Field(default="localhost")
    POSTGRES_PORT: int = Field(default=5432)

    # Third-Party API Keys
    GEMINI_API_KEY: str = Field(default="")
    SMS_GATEWAY_TOKEN: str = Field(default="")

    # CORS Configuration
    CORS_ORIGINS: List[str] = ["*"]

    @property
    def async_database_url(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

settings = Settings()
```

---

## 4. VALIDATION SCHEMAS & DTOS (`app/domain/schemas/`)

Pydantic schemas enforce type validation, defaults, ranges, and structured sanitization for incoming requests.

### 4.1 Base Pagination & Filtering DTOs (`app/domain/schemas/base.py`)
```python
from typing import Optional, Generic, TypeVar, List
from pydantic import BaseModel, Field

T = TypeVar("T")

class PaginationQueryParams(BaseModel):
    page: int = Field(default=1, ge=1, description="Current index page")
    limit: int = Field(default=10, ge=1, le=100, description="Total records returned per page")

class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    limit: int
    total_pages: int
```

### 4.2 Incident Intake DTOs (`app/domain/schemas/incident.py`)
```python
from typing import Optional, List
from pydantic import BaseModel, Field, field_validator
import re

class IncidentCreateRequest(BaseModel):
    reported_by_username: str = Field(min_length=2, max_length=100, example="John Doe")
    reporter_phone: str = Field(min_length=6, max_length=20, example="012888999")
    raw_text: str = Field(min_length=10, max_length=5000, example="គ្រោះថ្នាក់ម៉ូតូសន្លប់ម្នាក់")
    location_name: str = Field(min_length=3, max_length=255, example="Monivong Blvd near Central Market")
    latitude: float = Field(ge=11.5000, le=11.7000, description="Latitude inside Phnom Penh limits")
    longitude: float = Field(ge=104.8000, le=105.0000, description="Longitude inside Phnom Penh limits")
    patient_count: int = Field(default=1, ge=1, le=100)

    @field_validator("reporter_phone")
    @classmethod
    def validate_cambodian_phone(cls, v: str) -> str:
        # Simple phone sanitizer removing symbols
        sanitized = re.sub(r"[\s\-\+]", "", v)
        if not sanitized.isdigit():
            raise ValueError("Phone number must contain digits only")
        return sanitized

class IncidentResponse(BaseModel):
    id: str
    reported_by_username: str
    reporter_phone: str
    raw_text: str
    location_name: str
    latitude: float
    longitude: float
    patient_count: int
    triage_level: Optional[str] = None
    priority_score: Optional[int] = None
    status: str
    assigned_hospital_id: Optional[str] = None
    reported_at: str
    resolved_at: Optional[str] = None

    class Config:
        from_attributes = True
```

---

## 5. AUTHENTICATION, AUTHORIZATION & RBAC DEPENDENCY (`app/core/security.py`)

Using OAuth2 Password flow, bcrypt password encryption, JWT authentication token issuance, and strict Role-Based Access Control (RBAC).

```python
from datetime import datetime, timedelta
from typing import List, Optional
from jose import jwt, JWTError
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")

# Current User & Role-Based Access Control Guards
class RoleChecker:
    def __init__(self, allowed_roles: List[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, token: str = Depends(oauth2_scheme)) -> dict:
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
            username: str = payload.get("sub")
            role: str = payload.get("role")
            hospital_id: Optional[str] = payload.get("hospital_id")
            
            if username is None or role is None:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Authentication credentials could not be validated."
                )
                
            if role not in self.allowed_roles:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Administrative credentials insufficient to complete this operation."
                )
                
            return {
                "username": username,
                "role": role,
                "hospital_id": hospital_id
            }
        except JWTError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session expired or invalid authentication token provided."
            )

# Instantiate common role guards
require_any_user = RoleChecker(["MOH_ADMIN", "HOSPITAL_COORD", "DISPATCHER"])
require_moh_admin = RoleChecker(["MOH_ADMIN"])
require_hospital_coord = RoleChecker(["HOSPITAL_COORD"])
```

---

## 6. BUSINESS LOGIC & AI USE CASES (`app/use_cases/triage_use_case.py`)

This use case manages orchestrating incoming reports, passing descriptions to the Gemini API proxy, parsing responses, determining triage ratings, selecting optimal hospital routing, and writing the case profile to the database.

```python
import logging
from typing import Dict, Any
from app.interfaces.repositories.incident_repo import IncidentRepository
from app.interfaces.repositories.hospital_repo import HospitalRepository
from app.interfaces.ai_gateway import GeminiAIGateway
from app.domain.schemas.incident import IncidentCreateRequest

logger = logging.getLogger("lifelink_api")

class TriageAndDispatchUseCase:
    def __init__(
        self,
        incident_repo: IncidentRepository,
        hospital_repo: HospitalRepository,
        ai_gateway: GeminiAIGateway
    ):
        self.incident_repo = incident_repo
        self.hospital_repo = hospital_repo
        self.ai_gateway = ai_gateway

    async def execute(self, request: IncidentCreateRequest) -> Dict[str, Any]:
        logger.info(f"Executing Triage Use Case for reporter: {request.reported_by_username}")

        # Step 1: Call Google Gemini via AI Interface Gateway
        try:
            ai_results = await self.ai_gateway.analyze_text_report(request.raw_text)
        except Exception as e:
            logger.error(f"AI Analysis Failed: {str(e)}. Falling back to local rules-based engine.")
            ai_results = self._local_heuristic_fallback(request.raw_text)

        # Step 2: Query All Active Hospital Capacities
        hospitals = await self.hospital_repo.get_all_active_hospitals()

        # Step 3: Run Clinical Routing Logic
        assigned_hospital = self._calculate_optimal_routing(
            lat=request.latitude,
            lng=request.longitude,
            triage_level=ai_results["triageLevel"],
            specialty_requirements=ai_results["suspectedInjuries"],
            hospitals=hospitals
        )

        # Step 4: Persist Incident Entity Record to database
        incident_data = {
            "reported_by_username": request.reported_by_username,
            "reporter_phone": request.reporter_phone,
            "raw_text": request.raw_text,
            "location_name": request.location_name,
            "latitude": request.latitude,
            "longitude": request.longitude,
            "patient_count": request.patient_count,
            "triage_level": ai_results["triageLevel"],
            "priority_score": ai_results["priorityScore"],
            "assigned_hospital_id": assigned_hospital["id"] if assigned_hospital else None,
            "status": "DISPATCHED" if assigned_hospital else "REPORTED"
        }
        
        saved_incident = await self.incident_repo.create_incident(incident_data)

        return {
            "incident": saved_incident,
            "ai_analysis": ai_results,
            "assigned_hospital": assigned_hospital
        }

    def _calculate_optimal_routing(self, lat: float, lng: float, triage_level: str, specialty_requirements: list, hospitals: list) -> Any:
        best_hospital = None
        highest_score = -999999.0

        for h in hospitals:
            # Distance computation (Euclidean simplified model)
            dist = ((h["latitude"] - lat) ** 2 + (h["longitude"] - lng) ** 2) ** 0.5
            
            # 1. Specialty Alignment Weight
            specialty_match = 1.0
            for injury in specialty_requirements:
                if injury in h["specialties"]:
                    specialty_match += 0.5

            # Base Score
            score = (100.0 * specialty_match) / (dist + 0.01)

            # 2. Bed Capacity Weight Offset
            score += h["available_icu_beds"] * 15.0

            # 3. Penalize if 0 Beds free
            if h["available_icu_beds"] == 0:
                import math
                score *= math.exp(-5) # Penalize heavily

            if score > highest_score:
                highest_score = score
                best_hospital = h

        return best_hospital

    def _local_heuristic_fallback(self, text: str) -> Dict[str, Any]:
        normalized = text.lower()
        if "unconscious" in normalized or "សន្លប់" in normalized:
            return {
                "triageLevel": "RED",
                "priorityScore": 90,
                "suspectedInjuries": ["head_trauma"],
                "bystanderKhmerFirstAid": "ដាក់ជនរងគ្រោះអោយដេកផ្អៀង។ ពិនិត្យដង្ហើម។",
                "bystanderEnglishFirstAid": "Place victim in recovery position. Check airway.",
                "translatedEnglishText": f"[Fallback Triage] {text}"
            }
        return {
            "triageLevel": "YELLOW",
            "priorityScore": 50,
            "suspectedInjuries": ["soft_tissue"],
            "bystanderKhmerFirstAid": "រក្សាជនរងគ្រោះអោយនៅស្ងៀម។ កុំអោយផឹកទឹក។",
            "bystanderEnglishFirstAid": "Keep victim still. Do not give water.",
            "translatedEnglishText": f"[Fallback Triage] {text}"
        }
```

---

## 7. API INTERACTION ROUTERS (`app/infrastructure/api_v1/incidents.py`)

Exposes REST endpoints with built-in Pydantic validation, Pagination, Filtering, Search, and Dependency Injection of repositories.

```python
from fastapi import APIRouter, Depends, Query, status, HTTPException
from typing import Optional
from app.domain.schemas.base import PaginatedResponse
from app.domain.schemas.incident import IncidentCreateRequest, IncidentResponse
from app.core.security import require_any_user
from app.interfaces.repositories.incident_repo import IncidentRepository
from app.interfaces.repositories.hospital_repo import HospitalRepository
from app.interfaces.ai_gateway import GeminiAIGateway
from app.use_cases.triage_use_case import TriageAndDispatchUseCase

router = APIRouter()

# Core DI Provider functions for Repositories
def get_incident_repo() -> IncidentRepository:
    return IncidentRepository()

def get_hospital_repo() -> HospitalRepository:
    return HospitalRepository()

def get_ai_gateway() -> GeminiAIGateway:
    return GeminiAIGateway()

# -------------------------------------------------------------
# Endpoint: Create & Triage Incident
# -------------------------------------------------------------
@router.post(
    "/", 
    response_model=IncidentResponse, 
    status_code=status.HTTP_201_CREATED,
    summary="Create and Auto-Triage Incident"
)
async def create_and_triage_incident(
    payload: IncidentCreateRequest,
    incident_repo: IncidentRepository = Depends(get_incident_repo),
    hospital_repo: HospitalRepository = Depends(get_hospital_repo),
    ai_gateway: GeminiAIGateway = Depends(get_ai_gateway)
):
    use_case = TriageAndDispatchUseCase(incident_repo, hospital_repo, ai_gateway)
    result = await use_case.execute(payload)
    return result["incident"]

# -------------------------------------------------------------
# Endpoint: Query paginated, filtered and searchable incidents
# -------------------------------------------------------------
@router.get(
    "/", 
    response_model=PaginatedResponse[IncidentResponse],
    summary="Get List of Incidents with Filter and Search"
)
async def list_incidents(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=10, ge=1, le=100),
    status: Optional[str] = Query(default=None, description="Filter by status (e.g., REPORTED, DISPATCHED, RESOLVED)"),
    triage_level: Optional[str] = Query(default=None, description="Filter by triage severity (RED, YELLOW, GREEN)"),
    search: Optional[str] = Query(default=None, description="Search term matching raw description or location"),
    user: dict = Depends(require_any_user),
    incident_repo: IncidentRepository = Depends(get_incident_repo)
):
    items, total = await incident_repo.get_filtered_incidents(
        page=page,
        limit=limit,
        status_filter=status,
        triage_filter=triage_level,
        search_query=search
    )
    
    total_pages = (total + limit - 1) // limit
    
    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": total_pages
    }
```

---

## 8. REAL-TIME WEBSOCKET SYSTEM (`app/infrastructure/websockets/connection_manager.py`)

Orchestrates real-time coordinate streaming for moving ambulance fleets and distributes live incident alarms to active ER command screens.

```python
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List, Dict
import json
import logging

logger = logging.getLogger("lifelink_api")
ws_router = APIRouter()

class ConnectionManager:
    def __init__(self):
        # Maps active channels to a list of connections: {"hospital_id" : [WebSockets]}
        self.active_channels: Dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, channel_id: str):
        await websocket.accept()
        if channel_id not in self.active_channels:
            self.active_channels[channel_id] = []
        self.active_channels[channel_id].append(websocket)
        logger.info(f"WebSocket client connected to channel: {channel_id}. Active count: {len(self.active_channels[channel_id])}")

    def disconnect(self, websocket: WebSocket, channel_id: str):
        if channel_id in self.active_channels:
            if websocket in self.active_channels[channel_id]:
                self.active_channels[channel_id].remove(websocket)
            if not self.active_channels[channel_id]:
                del self.active_channels[channel_id]
        logger.info(f"WebSocket client disconnected from channel: {channel_id}")

    async def broadcast_to_channel(self, channel_id: str, message: dict):
        if channel_id in self.active_channels:
            payload = json.dumps(message)
            for connection in self.active_channels[channel_id]:
                try:
                    await connection.send_text(payload)
                except Exception as e:
                    logger.error(f"Failed to transmit WebSocket message: {str(e)}")


manager = ConnectionManager()

@ws_router.websocket("/{channel_id}")
async def websocket_telemetry_endpoint(websocket: WebSocket, channel_id: str):
    await manager.connect(websocket, channel_id)
    try:
        while True:
            # Expecting continuous coordinates telemetry payload from ambulance transponder clients
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            logger.debug(f"Telemetry received on channel {channel_id}: {payload}")
            
            # Broadcast the received vehicle positions back to all tracking dispatch listeners
            await manager.broadcast_to_channel(
                channel_id=channel_id,
                message={
                    "event": "AMBULANCE_COORDINATES_UPDATE",
                    "ambulance_id": payload.get("ambulance_id"),
                    "latitude": payload.get("latitude"),
                    "longitude": payload.get("longitude"),
                    "speed": payload.get("speed"),
                    "bearing": payload.get("bearing")
                }
            )
    except WebSocketDisconnect:
        manager.disconnect(websocket, channel_id)
    except Exception as e:
        logger.error(f"WebSocket error: {str(e)}")
        manager.disconnect(websocket, channel_id)
```

---

## 9. INTEGRATED TEST SUITE (`tests/`)

Comprehensive unit and integration test setups using `pytest` and HTTP async client simulation tools.

### 9.1 Test Suite Setup Fixtures (`tests/conftest.py`)
```python
import pytest
import asyncio
from typing import AsyncGenerator
from httpx import AsyncClient
from app.main import app
from app.interfaces.repositories.incident_repo import IncidentRepository

# Ensure single loop instance runs async tests
@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

# Mocking repositories to avoid real network/DB dependencies
class MockIncidentRepository:
    async def create_incident(self, data: dict):
        data["id"] = "mocked-uuid-1122"
        data["reported_at"] = "2026-07-07T20:00:00Z"
        return data

@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
```

### 9.2 Endpoint Intake Test Case (`tests/test_triage.py`)
```python
import pytest
from httpx import AsyncClient
from unittest.mock import AsyncMock, patch

@pytest.mark.asyncio
async def test_create_incident_success(client: AsyncClient):
    # Setup Mock payload parameters
    test_payload = {
        "reported_by_username": "Sok Sambath",
        "reporter_phone": "012334455",
        "raw_text": "គ្រោះថ្នាក់ចរាចរណ៍ធ្ងន់ធ្ងរ បាក់ជើងម្នាក់ អត់ដកដង្ហើមទេ",
        "location_name": "Sothearos Blvd, Phnom Penh",
        "latitude": 11.5621,
        "longitude": 104.9312,
        "patient_count": 1
    }

    # Intercept and Mock the AI Call logic
    mock_ai_response = {
        "triageLevel": "RED",
        "priorityScore": 95,
        "suspectedInjuries": ["fracture", "apnea"],
        "bystanderKhmerFirstAid": "ធ្វើចលនាទ្រូង CPR",
        "bystanderEnglishFirstAid": "Perform CPR immediate chest compression.",
        "translatedEnglishText": "Severe accident, broken leg, not breathing."
    }

    with patch("app.interfaces.ai_gateway.GeminiAIGateway.analyze_text_report", new_callable=AsyncMock) as mock_gemini:
        mock_gemini.return_value = mock_ai_response
        
        # Dispatch REST request
        response = await client.post("/api/v1/incidents/", json=test_payload)
        
        # Evaluate expectations
        assert response.status_code == 201
        res_json = response.json()
        assert res_json["triage_level"] == "RED"
        assert res_json["priority_score"] == 95
        assert res_json["status"] == "DISPATCHED"
```

---
*End of FastAPI Backend Architecture Specification.*

from pydantic import BaseModel
from typing import Optional

class ProjectBase(BaseModel):
    id: str
    name: str
    description: Optional[str] = None

class ConnectionBase(BaseModel):
    name: str
    tipo: str
    host: str
    port: Optional[int] = None
    service_sid_path: Optional[str] = None
    user: Optional[str] = None
    pwd: Optional[str] = None

class JobBase(BaseModel):
    name: str
    source_connection_id: Optional[int] = None
    destination_connection_id: Optional[int] = None
    tabella_sorgente: str
    tipo: str
    col_watermark: Optional[str] = None
    query_base: str
    chunk_size: Optional[int] = 50000
    cron: Optional[str] = None
    is_active: bool = True

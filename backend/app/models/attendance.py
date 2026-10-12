from sqlalchemy import Column, String, Date, Time, Text, Integer, TIMESTAMP, func
from sqlalchemy.dialects.postgresql import UUID
from .base import Base
import uuid

class Attendance(Base):
    __tablename__ = "pharma_hrms_attendance"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    employee_id = Column(String(255), nullable=False)
    date = Column(Date, nullable=False)
    status = Column(String(100), nullable=False, default='present')
    check_in_time = Column(Time)
    check_out_time = Column(Time)
    check_in_location = Column(Text)
    check_in_lat_lng = Column(String(50))
    check_in_photo_url = Column(Text)
    check_out_photo_url = Column(Text)
    punch_type = Column(String(50), default='in_office')
    punch_note = Column(Text)
    session_number = Column(Integer, default=1)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.current_timestamp())

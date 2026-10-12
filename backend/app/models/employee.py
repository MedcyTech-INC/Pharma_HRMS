from sqlalchemy import Column, String, Date, Numeric, Integer, JSON, TIMESTAMP, func
from .base import Base

class Employee(Base):
    __tablename__ = "pharma_hrms_employees"

    id = Column(String(255), primary_key=True)
    employee_code = Column(String(50))
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, default='employee')
    designation = Column(String(255), nullable=False)
    joining_date = Column(Date, default=func.current_date())
    basic_pay = Column(Numeric(12, 2), default=0.00)
    status = Column(String(50), nullable=False, default='active')
    phone = Column(String(100))
    gender = Column(String(10), default='male')
    experience = Column(Numeric(4, 1), default=0.0)
    dob = Column(Date)
    hospital = Column(String(50), default='orca_labs')
    branch = Column(String(50), default='corporate')
    hierarchy_level = Column(String(50), nullable=False, default='be')
    zone = Column(String(50), default='AP')
    territory = Column(String(100))
    reporting_to = Column(String(255))
    cl_balance = Column(Integer, default=12)
    pl_balance = Column(Integer, default=4)
    bank_details = Column(JSON, default=dict)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.current_timestamp())

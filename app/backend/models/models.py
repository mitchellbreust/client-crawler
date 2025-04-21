from datetime import datetime
from extensions import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(100), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    phone_number = db.Column(db.String(20))  # User's phone number for Twilio
    twilio_account_sid = db.Column(db.String(100))  # User's Twilio Account SID
    twilio_auth_token = db.Column(db.String(100))  # User's Twilio Auth Token
    messaging_provider = db.Column(db.String(20), default='twilio')  # 'twilio' or 'httpssms'
    httpssms_api_key = db.Column(db.String(200))  # API key if using HTTPS SMS
    
    # Relationships
    jobs = db.relationship('Job', backref='user', lazy=True)
    conversations = db.relationship('Conversation', backref='user', lazy=True)

class Job(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    business_name = db.Column(db.String(100), nullable=False)
    business_phone = db.Column(db.String(20), nullable=False)
    job_type = db.Column(db.String(50))
    url = db.Column(db.String(200))
    street = db.Column(db.String(100))
    suburb = db.Column(db.String(50))
    state = db.Column(db.String(20))
    postcode = db.Column(db.String(10))
    status = db.Column(db.String(20), default='pending')  # pending, contacted, interview, rejected, hired
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    
    # Relationships
    conversation = db.relationship('Conversation', backref='job', lazy=True, uselist=False)
    
class Conversation(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_message_time = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign keys
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    job_id = db.Column(db.Integer, db.ForeignKey('job.id'), nullable=False)
    
    # Relationships
    messages = db.relationship('Message', backref='conversation', lazy=True, order_by='Message.timestamp')

class Message(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    text = db.Column(db.String(500), nullable=False)
    is_from_user = db.Column(db.Boolean, default=True)  # True = sent by user, False = received from employer
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    twilio_sid = db.Column(db.String(50))  # Twilio message ID for tracking
    
    # Foreign key
    conversation_id = db.Column(db.Integer, db.ForeignKey('conversation.id'), nullable=False) 
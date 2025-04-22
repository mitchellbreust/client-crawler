from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse

import os
import requests
import subprocess
import csv
import threading
import uuid
import sys
import logging
import json
import re

from extensions import db
from models.models import User, Job, Conversation, Message
from flask_login import current_user, login_required

# Add the root directory to sys.path to be able to import the scraper module
# Go up one more level from project_root to reach the actual root where ClientContactDataFetcher is
backend_dir = os.path.abspath(os.path.dirname(os.path.dirname(__file__)))
app_dir = os.path.dirname(backend_dir)
root_dir = os.path.dirname(app_dir)
sys.path.insert(0, root_dir)
print(f"Added path: {root_dir}")
print(f"Current paths: {sys.path}")

# Import the scraper module
from ClientContactDataFetcher.LocalSearchDataFetcher import search_businesses, save_to_csv, main

api_bp = Blueprint('api', __name__)

# Store search status for each user with multiple searches
search_status = {}  # user_id -> { search_id -> status_dict }

# Twilio configuration
TWILIO_ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
TWILIO_AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
TWILIO_PHONE_NUMBER = os.getenv('TWILIO_PHONE_NUMBER')
twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

# DeepSeek API configuration
DEEPSEEK_API_KEY = os.getenv('DEEPSEEK_API_KEY')

# Helper function to import businesses to database
def import_businesses_to_db(businesses, user_id=None):
    """
    Import businesses to the database, avoiding duplicates.
    
    Args:
        businesses (list): List of business dictionaries
        user_id (int): User ID to associate with the imported businesses
    
    Returns:
        int: Number of new businesses imported
    """
    # If user_id is None, try to get it from current_user (for compatibility with direct calls)
    if user_id is None:
        if not current_user or not current_user.is_authenticated:
            logging.error("No authenticated user found when importing businesses")
            return 0
        user_id = current_user.id
        
    jobs_imported = 0
    
    for business in businesses:
        # Check if the job already exists (same business and phone)
        existing_job = Job.query.filter_by(
            business_name=business['name'],
            business_phone=business['phone'],
            user_id=user_id
        ).first()
        
        if existing_job:
            # Update classification if changed
            existing_job.job_type = business.get('category', existing_job.job_type)
            continue
        # Create a new job
        new_job = Job(
            business_name=business['name'],
            business_phone=business['phone'],
            url=business.get('url', ''),
            street=business.get('street', ''),
            suburb=business.get('suburb', ''),
            state=business.get('state', ''),
            postcode=business.get('postcode', ''),
            job_type=business.get('category', 'General'),
            status='pending',
            user_id=user_id
        )
        
        db.session.add(new_job)
        jobs_imported += 1
    
    # Commit all job additions
    db.session.commit()
    
    return jobs_imported

# Job routes
@api_bp.route('/jobs', methods=['GET'])
@jwt_required()
def get_jobs():
    current_user_id = get_jwt_identity()
    jobs = Job.query.filter_by(user_id=current_user_id).order_by(Job.created_at.desc()).all()
    
    job_list = []
    for job in jobs:
        job_data = {
            'id': job.id,
            'business_name': job.business_name,
            'business_phone': job.business_phone,
            'job_type': job.job_type,
            'url': job.url,
            'street': job.street,
            'suburb': job.suburb,
            'state': job.state,
            'postcode': job.postcode,
            'status': job.status,
            'created_at': job.created_at.isoformat(),
            'has_conversation': job.conversation is not None
        }
        job_list.append(job_data)
    
    return jsonify({'jobs': job_list}), 200

@api_bp.route('/jobs', methods=['POST'])
@jwt_required()
def create_job():
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    if not data or not data.get('business_name') or not data.get('business_phone'):
        return jsonify({'message': 'Business name and phone are required'}), 400
    
    # Check for duplicate job
    existing_job = Job.query.filter_by(
        business_name=data['business_name'],
        business_phone=data['business_phone'],
        user_id=current_user_id
    ).first()
    
    if existing_job:
        return jsonify({
            'message': 'A job with this business name and phone already exists',
            'job': {
                'id': existing_job.id,
                'business_name': existing_job.business_name,
                'business_phone': existing_job.business_phone,
                'job_type': existing_job.job_type,
                'status': existing_job.status
            }
        }), 409
    
    # Create new job
    new_job = Job(
        business_name=data['business_name'],
        business_phone=data['business_phone'],
        job_type=data.get('job_type', ''),
        url=data.get('url', ''),
        street=data.get('street', ''),
        suburb=data.get('suburb', ''),
        state=data.get('state', ''),
        postcode=data.get('postcode', ''),
        status='pending',
        user_id=current_user_id
    )
    
    db.session.add(new_job)
    db.session.commit()
    
    return jsonify({
        'message': 'Job created successfully',
        'job': {
            'id': new_job.id,
            'business_name': new_job.business_name,
            'business_phone': new_job.business_phone,
            'job_type': new_job.job_type,
            'status': new_job.status
        }
    }), 201

@api_bp.route('/jobs/<int:job_id>', methods=['PUT'])
@jwt_required()
def update_job(job_id):
    current_user_id = get_jwt_identity()
    job = Job.query.filter_by(id=job_id, user_id=current_user_id).first()
    
    if not job:
        return jsonify({'message': 'Job not found'}), 404
    
    data = request.get_json()
    
    # Update job fields
    for field in ['business_name', 'business_phone', 'job_type', 'url', 
                 'street', 'suburb', 'state', 'postcode', 'status']:
        if field in data:
            setattr(job, field, data[field])
    
    db.session.commit()
    
    return jsonify({
        'message': 'Job updated successfully',
        'job': {
            'id': job.id,
            'business_name': job.business_name,
            'business_phone': job.business_phone,
            'job_type': job.job_type,
            'status': job.status
        }
    }), 200

@api_bp.route('/jobs/<int:job_id>', methods=['DELETE'])
@jwt_required()
def delete_job(job_id):
    current_user_id = get_jwt_identity()
    job = Job.query.filter_by(id=job_id, user_id=current_user_id).first()
    
    if not job:
        return jsonify({'message': 'Job not found'}), 404
    
    # Delete associated conversation and messages if they exist
    if job.conversation:
        Message.query.filter_by(conversation_id=job.conversation.id).delete()
        db.session.delete(job.conversation)
    
    db.session.delete(job)
    db.session.commit()
    
    return jsonify({'message': 'Job deleted successfully'}), 200

# New endpoint for web scraping jobs with multiple search tracking
@api_bp.route('/search-jobs', methods=['POST'])
@jwt_required()
def search_jobs():
    # Get the actual Flask app instance from current_app
    flask_app = current_app._get_current_object()
    
    current_user_id = get_jwt_identity()
    data = request.get_json()
    
    # Validate required fields
    if not data or not data.get('what') or not data.get('where') or not data.get('state'):
        return jsonify({'message': 'Search parameters (what, where, state) are required'}), 400
    
    what = data['what']
    where = data['where']
    state = data['state']
    
    # Create a unique search ID based on the search parameters
    search_id = f"{what}_{where}_{state}".lower().replace(" ", "_")
    
    # Check if job with same parameters already exists and is active
    for job in search_status.get(current_user_id, {}):
        if job == search_id and search_status[current_user_id][job]['status'] != "completed" and search_status[current_user_id][job]['status'] != "error":
            return jsonify({
                'status': 'exists',
                'message': 'This search is already in progress',
                'job_id': search_id
            }), 409
    
    # Create a new job status entry
    job_entry = {
        'id': search_id,
        'what': what,
        'where': where,
        'state': state,
        'status': 'pending',
        'progress': 0,
        'message': 'Search job created',
        'results': [],
        'csv_path': None,
        'created_at': datetime.now().isoformat(),
        'completed_at': None
    }
    
    # Add to job status list (remove existing completed job with same ID if exists)
    search_status[current_user_id] = {**search_status.get(current_user_id, {}), search_id: job_entry}
    
    # Start scraping in a background thread
    def scrape_process():
        try:
            # Update status to running
            job_entry['status'] = 'running'
            job_entry['message'] = 'Scraping in progress...'
            
            # Progress update callback function
            def update_progress(progress, message, businesses=None):
                job_entry['progress'] = progress
                job_entry['message'] = message
                if businesses is not None:
                    job_entry['results'] = businesses
                    # Add a count of results for the frontend
                    job_entry['results_count'] = len(businesses)
            
            # Use the new main function from LocalSearchDataFetcher (returns list only)
            businesses = main(what, where, state, True, update_progress)
            csv_path = None
            
            # Import businesses to database - Create an application context for database operations
            # Use the actual Flask app instance with a proper app context
            with flask_app.app_context():
                try:
                    jobs_imported = import_businesses_to_db(businesses, current_user_id)
                    
                    # Update job with results
                    job_entry['results'] = businesses
                    job_entry['csv_path'] = csv_path
                    job_entry['status'] = 'completed'
                    job_entry['progress'] = 100
                    job_entry['message'] = f"Found {len(businesses)} businesses, imported {jobs_imported} new jobs"
                    job_entry['results_count'] = len(businesses)
                    job_entry['jobs_imported'] = jobs_imported
                    job_entry['completed_at'] = datetime.now().isoformat()
                except Exception as e:
                    job_entry['status'] = 'error'
                    job_entry['message'] = f"Database error: {str(e)}"
                    job_entry['completed_at'] = datetime.now().isoformat()
                    logging.exception("Error in database operations")
            
        except Exception as e:
            job_entry['status'] = 'error'
            job_entry['message'] = f"Error: {str(e)}"
            job_entry['completed_at'] = datetime.now().isoformat()
            logging.exception("Error in scrape_process")  # Log the full exception with traceback
    
    # Start the thread
    thread = threading.Thread(target=scrape_process)
    thread.daemon = True
    thread.start()
    
    return jsonify({
        'status': 'success',
        'message': 'Search job started',
        'job_id': search_id
    }), 202

# Updated endpoint to check multiple search statuses
@api_bp.route('/search-status', methods=['GET'])
@jwt_required()
def get_search_status():
    current_user_id = get_jwt_identity()
    
    # Get the search_id parameter if provided
    search_id = request.args.get('search_id')
    
    if search_id:
        # Return the status for a specific search
        if current_user_id in search_status and search_id in search_status[current_user_id]:
            return jsonify(search_status[current_user_id][search_id]), 200
        else:
            return jsonify({
                'status': 'not_found',
                'message': 'Search not found'
            }), 404
    else:
        # Return all search statuses for this user
        if current_user_id in search_status:
            # Convert to a list and sort by creation time (newest first)
            searches = list(search_status[current_user_id].values())
            searches.sort(key=lambda x: x.get('created_at', ''), reverse=True)
            
            # Limit to the most recent 10 searches
            searches = searches[:10]
            
            return jsonify({
                'searches': searches
            }), 200
        else:
            return jsonify({
                'searches': []
            }), 200

# Conversation routes
@api_bp.route('/jobs/<int:job_id>/conversation', methods=['GET'])
@jwt_required()
def get_conversation(job_id):
    current_user_id = get_jwt_identity()
    job = Job.query.filter_by(id=job_id, user_id=current_user_id).first()
    
    if not job:
        return jsonify({'message': 'Job not found'}), 404
    
    # Get or create conversation
    conversation = job.conversation
    if not conversation:
        return jsonify({'message': 'No conversation found for this job'}), 404
    
    # Get messages
    messages = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.timestamp).all()
    
    message_list = []
    for message in messages:
        message_data = {
            'id': message.id,
            'text': message.text,
            'is_from_user': message.is_from_user,
            'timestamp': message.timestamp.isoformat()
        }
        message_list.append(message_data)
    
    return jsonify({
        'conversation': {
            'id': conversation.id,
            'created_at': conversation.created_at.isoformat(),
            'messages': message_list,
            'job': {
                'id': job.id,
                'business_name': job.business_name,
                'business_phone': job.business_phone
            }
        }
    }), 200

@api_bp.route('/jobs/<int:job_id>/conversation', methods=['POST'])
@jwt_required()
def create_conversation(job_id):
    current_user_id = get_jwt_identity()
    job = Job.query.filter_by(id=job_id, user_id=current_user_id).first()
    
    if not job:
        return jsonify({'message': 'Job not found'}), 404
    
    # Check if conversation already exists
    if job.conversation:
        return jsonify({'message': 'Conversation already exists for this job', 
                       'conversation_id': job.conversation.id}), 409
    
    # Create new conversation
    new_conversation = Conversation(
        user_id=current_user_id,
        job_id=job_id
    )
    
    db.session.add(new_conversation)
    db.session.commit()
    
    return jsonify({
        'message': 'Conversation created successfully',
        'conversation': {
            'id': new_conversation.id,
            'created_at': new_conversation.created_at.isoformat()
        }
    }), 201

# Message routes
@api_bp.route('/conversations/<int:conversation_id>/messages', methods=['POST'])
@jwt_required()
def create_message(conversation_id):
    current_user_id = get_jwt_identity()
    conversation = Conversation.query.filter_by(id=conversation_id, user_id=current_user_id).first()
    
    if not conversation:
        return jsonify({'message': 'Conversation not found'}), 404
    
    data = request.get_json()
    logging.debug(f"create_message payload: {data}")
    
    if not data or not data.get('text'):
        return jsonify({'message': 'Message text is required'}), 400
    
    # Create new message
    new_message = Message(
        text=data['text'],
        is_from_user=True,
        conversation_id=conversation_id
    )
    
    # Update conversation last message time
    conversation.last_message_time = datetime.utcnow()
    
    db.session.add(new_message)
    db.session.commit()
    
    # Send SMS via Twilio or HTTPS SMS depending on user setting
    job = conversation.job
    user = User.query.get(current_user_id)
    if user.messaging_provider == 'httpssms':
        try:
            url = 'https://api.httpsms.com/v1/messages/send'
            headers = {
                'x-api-key': user.httpssms_api_key,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
            # Sanitize and format phone numbers to E.164
            raw_to = job.business_phone or ''
            has_plus_to = raw_to.strip().startswith('+')
            digits_to = re.sub(r'\D', '', raw_to)
            if has_plus_to:
                to_number = '+' + digits_to
            elif digits_to.startswith('0'):
                # Australian local numbers: replace leading 0 with country code
                to_number = '+61' + digits_to[1:]
            else:
                to_number = '+' + digits_to

            raw_from = user.phone_number or ''
            has_plus_from = raw_from.strip().startswith('+')
            digits_from = re.sub(r'\D', '', raw_from)
            if has_plus_from:
                from_number = '+' + digits_from
            elif digits_from.startswith('0'):
                from_number = '+61' + digits_from[1:]
            else:
                from_number = '+' + digits_from

            payload = {
                'content': data['text'],
                'from': from_number,
                'to': to_number
            }
            # Send per docs using raw JSON string in body
            resp = requests.post(url, headers=headers, data=json.dumps(payload))
            resp_data = resp.json()
            if resp.status_code != 200:
                logging.error(f"HTTPSMS error {resp.status_code}: {resp_data}")
                return jsonify({'message': 'HTTPSMS send failed', 'details': resp_data}), resp.status_code
            # Update job status
            if job.status == 'pending':
                job.status = 'contacted'
                db.session.commit()
        except Exception as e:
            logging.exception("Error sending SMS via HTTPSMS")
            return jsonify({'message': f'Error sending SMS via HTTPSMS: {str(e)}', 'message_id': new_message.id}), 500
    else:
        # Default to Twilio
        try:
            message = twilio_client.messages.create(
                body=data['text'],
                from_=TWILIO_PHONE_NUMBER,
                to=job.business_phone
            )
            new_message.twilio_sid = message.sid
            db.session.commit()
            if job.status == 'pending':
                job.status = 'contacted'
                db.session.commit()
        except Exception as e:
            logging.exception("Error sending SMS via Twilio")
            return jsonify({'message': f'Error sending SMS via Twilio: {str(e)}', 'message_id': new_message.id}), 500
    
    return jsonify({
        'message': 'Message sent successfully',
        'message_data': {
            'id': new_message.id,
            'text': new_message.text,
            'is_from_user': new_message.is_from_user,
            'timestamp': new_message.timestamp.isoformat(),
            'twilio_sid': new_message.twilio_sid
        }
    }), 201

# AI Message Generation
@api_bp.route('/generate-message', methods=['POST'])
@jwt_required()
def generate_message():
    data = request.get_json()
    
    if not data or not data.get('business_name') or not data.get('job_type'):
        return jsonify({'message': 'Business name and job type are required'}), 400
    
    # Optional extra context for AI prompt
    extra_context = data.get('extra_context', '').strip()
    
    business_name = data['business_name']
    job_type = data['job_type']
    
    try:
        api_key = DEEPSEEK_API_KEY
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
        example_message_2 = '''Hey, How's it going? I run a local flyer business and saw your in the area. Do you need a flyer drop? I'm in the area and can drop them off tomorrow if you need. My rates are $100 for 1000 flyers.'''
        example_message = '''Hey, How's it going? I was just wondering if you may be in need of a labourer for your plumbing business? I've recently 
                        relocated to cairns and am eager to get going! PLease let me know if you might be willing to give 
                        me a shot. Young, fit and reliable.'''
        
        # Compose AI messages array
        system_prompt = (
            f'Please generate a promotional SMS for the business naturally. Only generate one message and format it as if you where sending the actual text. In other words, only generate one message. Make it sound some what casual and friendly like a real person. Example message that are good that you can use as a template: \n\n Example 1: '
            + example_message + "\n\n Example 2: " + example_message_2
        )
        # Build user prompt with optional extra context
        user_prompt = f'Generate a message for {business_name} for a {job_type} job.'
        if extra_context:
            user_prompt += f' Extra context that the user might give you to help you generate a better message and make it more relevant to the business: {extra_context}'
        payload = {
            'model': 'deepseek-chat',
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': user_prompt}
            ],
            'temperature': 0.7
        }
        
        response = requests.post('https://api.deepseek.com/v1/chat/completions', headers=headers, json=payload)
        response_data = response.json()
        
        generated_message = response_data['choices'][0]['message']['content']
        
        return jsonify({'generated_message': generated_message}), 200
        
    except Exception as e:
        return jsonify({'message': f'Error generating message: {str(e)}'}), 500

# Twilio webhook for receiving SMS
@api_bp.route('/twilio_webhook', methods=['POST'])
def twilio_webhook():
    # Get SMS details from Twilio request
    from_number = request.form.get('From')
    body = request.form.get('Body')
    
    if not from_number or not body:
        return str(MessagingResponse()), 400
    
    # Find job by business phone number
    job = Job.query.filter_by(business_phone=from_number).first()
    
    if not job or not job.conversation:
        # No matching job or conversation found
        return str(MessagingResponse()), 404
    
    # Create new message in the conversation
    new_message = Message(
        text=body,
        is_from_user=False,  # Message from employer
        conversation_id=job.conversation.id
    )
    
    # Update conversation last message time
    job.conversation.last_message_time = datetime.utcnow()
    
    db.session.add(new_message)
    db.session.commit()
    
    # Return empty TwiML response to acknowledge receipt
    return str(MessagingResponse()), 200

@api_bp.route('/conversations', methods=['GET'])
@jwt_required()
def get_conversations():
    current_user_id = get_jwt_identity()
    
    # Get all conversations for the current user
    conversations = Conversation.query.filter_by(user_id=current_user_id).order_by(Conversation.last_message_time.desc()).all()
    
    if not conversations:
        return jsonify({
            'conversations': []
        }), 200
    
    conversations_data = []
    for conversation in conversations:
        # Get associated job
        job = Job.query.get(conversation.job_id)
        
        # Get last message
        last_message = Message.query.filter_by(conversation_id=conversation.id).order_by(Message.timestamp.desc()).first()
        last_message_text = last_message.text if last_message else None
        
        conversations_data.append({
            'id': conversation.id,
            'job_id': job.id,
            'business_name': job.business_name,
            'job_title': job.job_type,
            'business_phone': job.business_phone,
            'last_message': last_message_text,
            'updated_at': conversation.last_message_time.isoformat(),
            'created_at': conversation.created_at.isoformat()
        })
    
    return jsonify({
        'conversations': conversations_data
    }), 200 
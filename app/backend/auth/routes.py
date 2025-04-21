from flask import Blueprint, request, jsonify, current_app
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
import bcrypt

from extensions import db
from models.models import User

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json()
    
    # Check if required fields are provided
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Email and password are required'}), 400
    
    # Check if user already exists
    existing_user = User.query.filter_by(email=data['email']).first()
    if existing_user:
        return jsonify({'message': 'User already exists'}), 409
    
    # Hash the password
    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    
    # Create new user
    new_user = User(
        email=data['email'],
        password=hashed_password.decode('utf-8'),
        phone_number=data.get('phone_number', '')
    )
    
    # Save to database
    db.session.add(new_user)
    db.session.commit()
    
    # Generate access token
    access_token = create_access_token(identity=new_user.id)
    
    return jsonify({
        'message': 'User registered successfully',
        'access_token': access_token,
        'user': {
            'id': new_user.id,
            'email': new_user.email,
            'phone_number': new_user.phone_number
        }
    }), 201

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json()
    
    # Check if required fields are provided
    if not data or not data.get('email') or not data.get('password'):
        return jsonify({'message': 'Email and password are required'}), 400
    
    # Find user by email
    user = User.query.filter_by(email=data['email']).first()
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    # Check password
    if bcrypt.checkpw(data['password'].encode('utf-8'), user.password.encode('utf-8')):
        # Generate access token
        access_token = create_access_token(identity=user.id)
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': {
                'id': user.id,
                'email': user.email,
                'phone_number': user.phone_number
            }
        }), 200
    else:
        return jsonify({'message': 'Invalid credentials'}), 401

@auth_bp.route('/user', methods=['GET'])
@jwt_required()
def get_user():
    # Get user ID from JWT
    current_user_id = get_jwt_identity()
    
    # Find user by ID
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    return jsonify({
        'user': {
            'id': user.id,
            'email': user.email,
            'phone_number': user.phone_number,
            'twilio_account_sid': user.twilio_account_sid,
            'twilio_auth_token': user.twilio_auth_token,
            'messaging_provider': user.messaging_provider,
            'httpssms_api_key': user.httpssms_api_key
        }
    }), 200

@auth_bp.route('/user', methods=['PUT'])
@jwt_required()
def update_user():
    # Update user settings (phone and Twilio credentials)
    current_user_id = get_jwt_identity()
    data = request.get_json()
    user = User.query.get(current_user_id)
    if not user:
        return jsonify({'message': 'User not found'}), 404
    
    # Update fields if provided
    if 'phone_number' in data:
        user.phone_number = data['phone_number']
    if 'twilio_account_sid' in data:
        user.twilio_account_sid = data['twilio_account_sid']
    if 'twilio_auth_token' in data:
        user.twilio_auth_token = data['twilio_auth_token']
    if 'messaging_provider' in data:
        user.messaging_provider = data['messaging_provider']
    if 'httpssms_api_key' in data:
        user.httpssms_api_key = data['httpssms_api_key']
    
    db.session.commit()
    
    return jsonify({
        'message': 'Settings updated successfully',
        'user': {
            'id': user.id,
            'email': user.email,
            'phone_number': user.phone_number,
            'twilio_account_sid': user.twilio_account_sid,
            'twilio_auth_token': user.twilio_auth_token,
            'messaging_provider': user.messaging_provider,
            'httpssms_api_key': user.httpssms_api_key
        }
    }), 200 
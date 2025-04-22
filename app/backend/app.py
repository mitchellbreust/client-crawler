import os
import sys
import logging
from flask import Flask
from dotenv import load_dotenv
import logging as _logging

# Add current directory to Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Configure logging
logging.basicConfig(level=logging.DEBUG)

# Silence noisy HTTP debug logs from urllib3
_logging.getLogger('urllib3').setLevel(_logging.WARNING)
_logging.getLogger('requests.packages.urllib3').setLevel(_logging.WARNING)

logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def create_app():
    # Initialize Flask app
    app = Flask(__name__)
    
    # Get absolute path for database
    basedir = os.path.abspath(os.path.dirname(__file__))
    db_path = os.path.join(basedir, 'instance', 'jobs.db')
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    
    # Database configuration with absolute path
    app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ECHO'] = False  # Disable SQL logging
    
    # JWT configuration
    app.config['JWT_SECRET_KEY'] = os.getenv('JWT_SECRET_KEY', 'dev-secret-key')
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = 86400  # 24 hours
    app.config['JWT_TOKEN_LOCATION'] = ['headers']
    app.config['JWT_HEADER_NAME'] = 'Authorization'
    app.config['JWT_HEADER_TYPE'] = 'Bearer'
    
    # Silence verbose SQLAlchemy engine logs
    logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
    
    # Initialize extensions
    from extensions import db, jwt, cors
    db.init_app(app)
    jwt.init_app(app)
    
    # Configure CORS to allow requests from any origin
    cors.init_app(app, resources={r"/*": {"origins": "*", "supports_credentials": True}})
    
    # Import blueprints
    from auth.routes import auth_bp
    from api.routes import api_bp
    
    # Register blueprints
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(auth_bp, url_prefix='/auth')
    
    # Create database tables
    with app.app_context():
        # Import models
        from models.models import User, Job, Conversation, Message
        
        logger.info(f"Creating database tables at: {db_path}")
        db.create_all()
        logger.info("Database tables created successfully")
    
    @app.after_request
    def after_request(response):
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
        response.headers.add('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
        return response
    
    return app

if __name__ == '__main__':
    app = create_app()
    logger.info("Starting Flask server on host='0.0.0.0', port=5000")
    app.run(host='0.0.0.0', port=5000, debug=True) 
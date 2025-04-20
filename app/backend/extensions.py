from flask_sqlalchemy import SQLAlchemy
from flask_jwt_extended import JWTManager
from flask_cors import CORS

# Create extensions instances without initializing them
db = SQLAlchemy()
jwt = JWTManager()
cors = CORS()

# JWT Identity handler to convert user IDs to strings
@jwt.user_identity_loader
def user_identity_lookup(user_id):
    return str(user_id)

# JWT User loader to verify user exists
@jwt.user_lookup_loader
def user_lookup_callback(_jwt_header, jwt_data):
    from models.models import User
    identity = jwt_data["sub"]
    return User.query.filter_by(id=int(identity)).first() 
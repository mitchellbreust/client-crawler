# Labour Job Search Backend

This is the Flask backend for the Labour Job Search Web App.

## Setup

1. Create a virtual environment:
```bash
python -m venv venv
```

2. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file by copying `.env.example`:
```bash
cp .env.example .env
```

5. Update the `.env` file with your actual API keys and settings.

## Running the Server

To run the development server:
```bash
python app.py
```

The API will be available at `http://localhost:5000`.

## API Endpoints

### Authentication
- `POST /auth/register` - Register a new user
- `POST /auth/login` - Log in a user
- `GET /auth/user` - Get current user details

### Jobs
- `GET /api/jobs` - Get all jobs for current user
- `POST /api/jobs` - Create a new job
- `PUT /api/jobs/<job_id>` - Update a job
- `DELETE /api/jobs/<job_id>` - Delete a job

### Conversations
- `GET /api/jobs/<job_id>/conversation` - Get conversation for a job
- `POST /api/jobs/<job_id>/conversation` - Create a new conversation for a job

### Messages
- `POST /api/conversations/<conversation_id>/messages` - Create a new message

### AI Integration
- `POST /api/generate-message` - Generate a message using DeepSeek API

### Twilio Webhook
- `POST /api/twilio_webhook` - Webhook for incoming Twilio SMS messages

## Data Import

To import jobs from a CSV file:
```bash
python utils/import_data.py path/to/csv_file.csv user_id
``` 
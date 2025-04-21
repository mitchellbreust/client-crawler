# Labour Job Search Web App with Twilio Integration

A full-stack web application that helps users manage job applications via a virtual phone interface, with AI-generated messages, conversation tracking, and SMS integration using Twilio.

## Project Overview

This application consists of:
- **Backend**: Flask REST API with SQLite database (configurable for PostgreSQL in production)
- **Frontend**: React application with a virtual phone interface
- **SMS Integration**: Twilio for sending and receiving text messages
- **AI Message Generation**: DeepSeek API for generating job application messages

## Features

- User authentication (JWT-based)
- Job listing management (CRUD operations)
- Virtual phone interface for messaging
- AI-generated messages for job applications
- Real-time SMS integration with Twilio
- Conversation history tracking
- Import jobs from CSV files

## Project Structure

```
├── app
│   ├── backend
│   │   ├── api             # API routes
│   │   ├── auth            # Authentication routes
│   │   ├── models          # Database models
│   │   ├── utils           # Utility functions
│   │   ├── config          # Configuration files
│   │   ├── app.py          # Main Flask application
│   │   ├── requirements.txt # Python dependencies
│   │   ├── .env            # Environment variables
│   │   └── utils           # Import utility
│   ├── frontend
│   │   ├── src
│   │   │   ├── components  # React components
│   │   │   ├── context     # React context (auth)
│   │   │   ├── App.js      # Main React application
│   │   ├── package.json    # npm dependencies
│   │   └── .env            # Environment variables
│   ├── ClientContactData       # CSV data files
│   └── ClientContactDataFetcher # Data scraping scripts
```

## Setup and Installation

### Backend Setup

1. Navigate to the backend directory:
```bash
cd app/backend
```

2. Create a virtual environment:
```bash
python -m venv venv
```

3. Activate the virtual environment:
- Windows: `venv\Scripts\activate`
- Mac/Linux: `source venv/bin/activate`

4. Install dependencies:
```bash
pip install -r requirements.txt
```

5. Create a `.env` file by copying `.env.example`:
```bash
cp .env.example .env
```

6. Update the `.env` file with your API keys and settings, especially:
- Twilio credentials (account SID, auth token, and phone number)
- DeepSeek API key
- JWT secret key

7. Run the Flask server:
```bash
python app.py
```

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd app/frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

## Using the App

1. Register a new account
2. Add jobs from the Jobs page
3. Click "Apply" on a job to start a conversation
4. Use the "Generate Message with AI" button to create a message
5. Send the message via SMS
6. View incoming replies in the conversation

## Twilio Webhook Configuration

To receive SMS replies, configure your Twilio phone number webhook URL:
1. In the Twilio console, navigate to Phone Numbers > Manage > Active Numbers
2. Click on your number and scroll to "Messaging"
3. Set the webhook URL to: `https://your-domain.com/api/twilio_webhook`
4. Set the HTTP method to POST

## Importing Jobs from CSV

Use the import utility to add jobs from CSV files:
```bash
cd app/backend
python utils/import_data.py path/to/csv_file.csv user_id
```

The CSV should have these columns: name, phone, url, street, suburb, state, postcode

## Deployment

### Backend Deployment (e.g., to Render or Fly.io)
1. Create a new web service
2. Point to the app/backend directory
3. Configure environment variables from your .env file
4. Set the build command: `pip install -r requirements.txt`
5. Set the start command: `gunicorn app:create_app()`

### Frontend Deployment (e.g., to Vercel)
1. Connect your repository to Vercel
2. Set the root directory to app/frontend
3. Configure the build settings:
   - Build command: `npm run build`
   - Output directory: `build`

## Credits

- Data scraping utilities from ClientContactDataFetcher
- AI integration using DeepSeek API
- SMS integration via Twilio 
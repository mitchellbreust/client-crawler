import csv
import os
import sys
import argparse
from flask import Flask
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import create_app, db
from models.models import Job, User

def import_jobs_from_csv(csv_file, user_id):
    """Import jobs from a CSV file into the database."""
    app = create_app()
    
    with app.app_context():
        # Check if user exists
        user = User.query.get(user_id)
        if not user:
            print(f"Error: User with ID {user_id} not found.")
            return
        
        # Read CSV file
        jobs_added = 0
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Check if job already exists based on business name and phone
                existing_job = Job.query.filter_by(
                    business_name=row['name'], 
                    business_phone=row['phone'],
                    user_id=user_id
                ).first()
                
                if not existing_job:
                    # Create new job
                    new_job = Job(
                        business_name=row['name'],
                        business_phone=row['phone'],
                        url=row.get('url', ''),
                        street=row.get('street', ''),
                        suburb=row.get('suburb', ''),
                        state=row.get('state', ''),
                        postcode=row.get('postcode', ''),
                        status='pending',
                        user_id=user_id
                    )
                    
                    db.session.add(new_job)
                    jobs_added += 1
        
        # Commit changes
        db.session.commit()
        print(f"Successfully imported {jobs_added} jobs from {csv_file}.")

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Import jobs from CSV file.')
    parser.add_argument('csv_file', help='Path to CSV file')
    parser.add_argument('user_id', type=int, help='User ID to associate with the jobs')
    
    args = parser.parse_args()
    
    # Validate CSV file
    if not os.path.exists(args.csv_file):
        print(f"Error: CSV file {args.csv_file} not found.")
        sys.exit(1)
    
    import_jobs_from_csv(args.csv_file, args.user_id) 
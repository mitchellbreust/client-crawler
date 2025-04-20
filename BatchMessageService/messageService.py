from twilio.rest import Client
from twilio.twiml.messaging_response import MessagingResponse
import requests
import time
import csv

def generate_message(business_info):
    print(business_info)
    api_key = 
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    example_message = '''Hey, How's it going? I was just wondering if you may be in need of a labourer for your plumbing business? I've recently 
                    relocated to cairns and am eager to get going! PLease let me know if you might be willing to give 
                    me a shot. Young, fit and reliable. 
                    '''
    data = {
        'model': 'deepseek-chat',
        'messages': [
            {'role': 'system', 'content': 'Please generate a message for the business given csv data row: name,phone,url,street,suburb,state,postcode. For response, blend in details about the business naturally. Example message: ' + example_message},
            {'role': 'user', 'content': 'Business info: ' + business_info}
        ],
        'temperature': 0.7
    }
    time.sleep(2)
    response = requests.post('https://api.deepseek.com/v1/chat/completions', headers=headers, json=data)
    response_data = response.json()
    return response_data['choices'][0]['message']['content']

def send_msg(client, msg, phone_num):
    client.messages.create(
        from_='+16074994714',
        body=msg,
        to=phone_num.strip()
    )

def send_message(data_source):
    account_sid = 
    auth_token = 
    client = Client(account_sid, auth_token)

    with open(data_source, 'r', newline='', encoding='utf-8') as open_f:
        reader = csv.DictReader(open_f)
        count = 0
        for row in reader:
            if count >= 10:
                break

            business_info = f"{row['name']},{row['phone']},{row['url']},{row['street']},{row['suburb']},{row['state']},{row['postcode']}"
            msg = generate_message(business_info)
            print(msg)
            send_msg(client, '+61410413506', msg)

            count += 1



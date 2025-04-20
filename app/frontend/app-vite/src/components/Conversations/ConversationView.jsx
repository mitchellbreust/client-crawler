import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import axios from 'axios';
import styled from 'styled-components';

const ConversationView = () => {
  const { jobId } = useParams();
  const messagesEndRef = useRef(null);
  
  const [job, setJob] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [conversationId, setConversationId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  const [pollingInterval, setPollingInterval] = useState(null);
  
  // Fetch conversation details
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/jobs/${jobId}/conversation`);
        
        setJob(response.data.conversation.job);
        setMessages(response.data.conversation.messages);
        setConversationId(response.data.conversation.id);
        setLoading(false);
      } catch (err) {
        setError('Failed to load conversation. Please try again.');
        setLoading(false);
        console.error(err);
      }
    };
    
    fetchConversation();
    
    // Start polling for new messages every 10 seconds
    const interval = setInterval(fetchConversation, 10000);
    setPollingInterval(interval);
    
    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [jobId]);
  
  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);
  
  const handleSendMessage = async () => {
    if (!newMessage.trim() || !conversationId) {
      return;
    }
    
    try {
      setIsSending(true);
      
      const response = await axios.post(`/api/conversations/${conversationId}/messages`, {
        text: newMessage,
        send_sms: true
      });
      
      // Add the new message to the list
      setMessages([...messages, response.data.message_data]);
      
      // Clear the input
      setNewMessage('');
      setIsSending(false);
    } catch (err) {
      setError('Failed to send message. Please try again.');
      setIsSending(false);
      console.error(err);
    }
  };
  
  const handleGenerateMessage = async () => {
    try {
      if (!job) return;
      
      const response = await axios.post('/api/generate-message', {
        business_name: job.business_name,
        job_type: job.job_type || 'labour'
      });
      
      setNewMessage(response.data.generated_message);
    } catch (err) {
      setError('Failed to generate message. Please try again.');
      console.error(err);
    }
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
  };
  
  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = {};
    
    messages.forEach(message => {
      const date = new Date(message.timestamp).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };
  
  if (loading) {
    return <LoadingMessage>Loading conversation...</LoadingMessage>;
  }
  
  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }
  
  const groupedMessages = groupMessagesByDate();
  
  return (
    <ConversationContainer>
      <ConversationHeader>
        <HeaderLeft>
          <BackLink to="/jobs">← Back to Jobs</BackLink>
          <BusinessName>{job?.business_name}</BusinessName>
        </HeaderLeft>
        <HeaderRight>
          <PhoneNumber>{job?.business_phone}</PhoneNumber>
        </HeaderRight>
      </ConversationHeader>
      
      <PhoneContainer>
        <MessagesContainer>
          {Object.keys(groupedMessages).map(date => (
            <MessageGroup key={date}>
              <DateDivider>
                <DateLabel>{formatDate(new Date(date))}</DateLabel>
              </DateDivider>
              
              {groupedMessages[date].map(message => (
                <MessageWrapper key={message.id} isFromUser={message.is_from_user}>
                  <Message isFromUser={message.is_from_user}>
                    {message.text}
                    <MessageTime>{formatTime(message.timestamp)}</MessageTime>
                  </Message>
                </MessageWrapper>
              ))}
            </MessageGroup>
          ))}
          
          <div ref={messagesEndRef} />
        </MessagesContainer>
        
        <InputContainer>
          <MessageTextarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
          />
          <ButtonsContainer>
            <GenerateButton onClick={handleGenerateMessage}>
              Generate with AI
            </GenerateButton>
            <SendButton 
              onClick={handleSendMessage} 
              disabled={isSending || !newMessage.trim()}
            >
              {isSending ? 'Sending...' : 'Send'}
            </SendButton>
          </ButtonsContainer>
        </InputContainer>
      </PhoneContainer>
    </ConversationContainer>
  );
};

// Styled Components
const ConversationContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
`;

const ConversationHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
`;

const HeaderLeft = styled.div``;

const HeaderRight = styled.div``;

const BackLink = styled(Link)`
  display: block;
  margin-bottom: 5px;
  color: #4a90e2;
  font-size: 14px;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

const BusinessName = styled.h1`
  margin: 0;
  color: #333;
  font-size: 20px;
`;

const PhoneNumber = styled.div`
  color: #666;
  font-size: 14px;
`;

const PhoneContainer = styled.div`
  background-color: white;
  border-radius: 12px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  height: 70vh;
  display: flex;
  flex-direction: column;
`;

const MessagesContainer = styled.div`
  flex: 1;
  padding: 20px;
  overflow-y: auto;
  background-color: #f5f5f5;
`;

const MessageGroup = styled.div`
  margin-bottom: 20px;
`;

const DateDivider = styled.div`
  display: flex;
  justify-content: center;
  margin: 15px 0;
`;

const DateLabel = styled.span`
  background-color: #e4e4e4;
  padding: 5px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #666;
`;

const MessageWrapper = styled.div`
  display: flex;
  justify-content: ${props => props.isFromUser ? 'flex-end' : 'flex-start'};
  margin-bottom: 10px;
`;

const Message = styled.div`
  max-width: 70%;
  padding: 10px 15px;
  border-radius: 18px;
  font-size: 14px;
  position: relative;
  
  ${props => props.isFromUser ? `
    background-color: #4a90e2;
    color: white;
    border-bottom-right-radius: 4px;
  ` : `
    background-color: white;
    color: #333;
    border-bottom-left-radius: 4px;
  `}
`;

const MessageTime = styled.span`
  font-size: 10px;
  opacity: 0.8;
  position: absolute;
  bottom: 4px;
  right: 10px;
`;

const InputContainer = styled.div`
  padding: 15px;
  border-top: 1px solid #eee;
`;

const MessageTextarea = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 20px;
  font-size: 14px;
  resize: none;
  margin-bottom: 10px;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

const ButtonsContainer = styled.div`
  display: flex;
  justify-content: space-between;
`;

const SendButton = styled.button`
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #3a7bd5;
  }
  
  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const GenerateButton = styled.button`
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #eeeeee;
  }
`;

const LoadingMessage = styled.div`
  text-align: center;
  padding: 40px 0;
  color: #666;
`;

const ErrorMessage = styled.div`
  background-color: #ffebee;
  color: #c62828;
  padding: 15px;
  border-radius: 8px;
  margin: 20px 0;
`;

export default ConversationView; 
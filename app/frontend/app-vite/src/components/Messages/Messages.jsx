import React, { useState, useEffect, useContext, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../../context/AuthContext';
import axios from 'axios';
import { conversationsAPI } from '../../services/api';

const Messages = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();
  const { jobId } = useParams(); // Support for direct navigation to a specific job conversation
  const messagesEndRef = useRef(null);
  
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState(null);

  // Fetch conversations on component mount
  useEffect(() => {
    fetchConversations();
  }, []);

  // Select conversation based on URL or default to first conversation
  useEffect(() => {
    if (conversations.length > 0) {
      if (jobId) {
        const jobConversation = conversations.find(conv => conv.job_id === parseInt(jobId));
        if (jobConversation) {
          setSelectedConversation(jobConversation);
        } else {
          setSelectedConversation(conversations[0]);
        }
      } else if (!selectedConversation) {
        setSelectedConversation(conversations[0]);
      }
    }
  }, [conversations, jobId]);

  // Fetch messages when a conversation is selected
  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      // Update URL without reloading if conversation has a job_id
      if (selectedConversation.job_id && !jobId) {
        navigate(`/messages/${selectedConversation.job_id}`, { replace: true });
      }
    }
  }, [selectedConversation]);

  // Scroll to bottom of messages
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      const response = await conversationsAPI.getConversations();
      setConversations(response.data.conversations || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      setError('Failed to load conversations. Please try again.');
      setLoading(false);
    }
  };

  const fetchMessages = async (conversationId) => {
    try {
      const response = await axios.get(`/api/conversations/${conversationId}/messages`);
      setMessages(response.data.messages || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
      setError('Failed to load messages. Please try again.');
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      setIsSending(true);
      await axios.post(`/api/conversations/${selectedConversation.id}/messages`, {
        content: newMessage,
        send_sms: true
      });
      setNewMessage('');
      fetchMessages(selectedConversation.id);
      setIsSending(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message. Please try again.');
      setIsSending(false);
    }
  };

  const handleGenerateMessage = async () => {
    try {
      if (!selectedConversation || !selectedConversation.job_title) return;
      
      const response = await axios.post('/api/generate-message', {
        business_name: selectedConversation.business_name || selectedConversation.job_title,
        job_type: selectedConversation.job_type || 'labour'
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
      sendMessage(e);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString();
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Group messages by date
  const groupMessagesByDate = () => {
    const groups = {};
    
    messages.forEach(message => {
      const date = new Date(message.created_at).toLocaleDateString();
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(message);
    });
    
    return groups;
  };

  return (
    <Container>
      {error && <ErrorBanner>{error}</ErrorBanner>}
      
      <MessagesLayout>
        <ConversationsList>
          <ConversationsHeader>
            <h2>Messages</h2>
          </ConversationsHeader>
          {loading ? (
            <LoadingText>Loading conversations...</LoadingText>
          ) : conversations.length === 0 ? (
            <NoConversations>No conversations found</NoConversations>
          ) : (
            conversations.map((conversation) => (
              <ConversationItem 
                key={conversation.id} 
                active={selectedConversation?.id === conversation.id}
                onClick={() => setSelectedConversation(conversation)}
              >
                <ConversationTitle>
                  {conversation.business_name || conversation.job_title || 'Untitled Conversation'}
                </ConversationTitle>
                <ConversationPreview>
                  {conversation.last_message || 'No messages yet'}
                </ConversationPreview>
                {conversation.updated_at && (
                  <ConversationTime>
                    {formatDate(conversation.updated_at)}
                  </ConversationTime>
                )}
              </ConversationItem>
            ))
          )}
        </ConversationsList>
        
        <MessagesView>
          {selectedConversation ? (
            <>
              <MessagesHeader>
                <h3>{selectedConversation.business_name || selectedConversation.job_title || 'Conversation'}</h3>
                {selectedConversation.job_id && (
                  <ViewJobButton onClick={() => navigate(`/jobs/${selectedConversation.job_id}`)}>
                    View Job Details
                  </ViewJobButton>
                )}
              </MessagesHeader>
              
              <MessagesList>
                {messages.length === 0 ? (
                  <NoMessages>No messages in this conversation</NoMessages>
                ) : (
                  Object.entries(groupMessagesByDate()).map(([date, dateMessages]) => (
                    <MessageGroup key={date}>
                      <DateDivider>
                        <DateLabel>{date}</DateLabel>
                      </DateDivider>
                      
                      {dateMessages.map((message) => (
                        <MessageItem key={message.id} isUser={message.is_user}>
                          <MessageContent isUser={message.is_user}>
                            {message.content}
                            <MessageTime>{formatTime(message.created_at)}</MessageTime>
                          </MessageContent>
                        </MessageItem>
                      ))}
                    </MessageGroup>
                  ))
                )}
                <div ref={messagesEndRef} />
              </MessagesList>
              
              <MessageInputForm onSubmit={sendMessage}>
                <MessageInput
                  type="text"
                  placeholder="Type a message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
                <ButtonsContainer>
                  <GenerateButton 
                    type="button"
                    onClick={handleGenerateMessage}
                    disabled={!selectedConversation?.job_id}
                  >
                    Generate with AI
                  </GenerateButton>
                  <SendButton 
                    type="submit" 
                    disabled={!newMessage.trim() || isSending}
                  >
                    {isSending ? 'Sending...' : 'Send'}
                  </SendButton>
                </ButtonsContainer>
              </MessageInputForm>
            </>
          ) : (
            <NoConversationSelected>
              Select a conversation to view messages
            </NoConversationSelected>
          )}
        </MessagesView>
      </MessagesLayout>
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  max-width: 1200px;
  margin: 20px auto;
  padding: 0 20px;
`

const MessagesLayout = styled.div`
  display: grid;
  grid-template-columns: 300px 1fr;
  height: calc(100vh - 120px);
  background: white;
  border-radius: 8px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const ConversationsList = styled.div`
  border-right: 1px solid #eee;
  overflow-y: auto;
`;

const ConversationsHeader = styled.div`
  padding: 15px;
  border-bottom: 1px solid #eee;
  
  h2 {
    margin: 0;
    font-size: 18px;
    color: #333;
  }
`;

const ConversationItem = styled.div`
  padding: 15px;
  cursor: pointer;
  border-bottom: 1px solid #eee;
  background-color: ${props => props.active ? '#f5f8ff' : 'white'};
  
  &:hover {
    background-color: ${props => props.active ? '#f5f8ff' : '#f7f7f7'};
  }
`;

const ConversationTitle = styled.div`
  font-weight: 600;
  margin-bottom: 5px;
  color: #333;
`;

const ConversationPreview = styled.div`
  font-size: 14px;
  color: #888;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ConversationTime = styled.div`
  font-size: 12px;
  color: #aaa;
  margin-top: 5px;
  text-align: right;
`;

const MessagesView = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const MessagesHeader = styled.div`
  padding: 15px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  h3 {
    margin: 0;
    font-size: 16px;
    color: #333;
  }
`;

const ViewJobButton = styled.button`
  background-color: #f0f4f8;
  color: #4a90e2;
  border: none;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: #e1eaf5;
  }
`;

const MessagesList = styled.div`
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const MessageGroup = styled.div`
  margin-bottom: 15px;
`;

const DateDivider = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 10px 0;
`;

const DateLabel = styled.span`
  background: #f0f0f0;
  padding: 5px 10px;
  border-radius: 10px;
  font-size: 12px;
  color: #666;
`;

const MessageItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: ${props => props.isUser ? 'flex-end' : 'flex-start'};
  margin-bottom: 10px;
`;

const MessageContent = styled.div`
  background-color: ${props => props.isUser ? '#0084ff' : '#f1f0f0'};
  color: ${props => props.isUser ? 'white' : '#333'};
  padding: 10px 15px;
  border-radius: 18px;
  max-width: 70%;
  word-wrap: break-word;
  position: relative;
`;

const MessageTime = styled.div`
  font-size: 11px;
  color: ${props => props.isUser ? 'rgba(255, 255, 255, 0.7)' : '#888'};
  margin-top: 4px;
  text-align: right;
`;

const MessageInputForm = styled.form`
  display: flex;
  flex-direction: column;
  padding: 15px;
  border-top: 1px solid #eee;
  gap: 10px;
`;

const MessageInput = styled.input`
  flex: 1;
  border: 1px solid #ddd;
  border-radius: 20px;
  padding: 12px 15px;
  font-size: 14px;
  outline: none;
  
  &:focus {
    border-color: #4a90e2;
  }
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 10px;
  justify-content: flex-end;
`;

const GenerateButton = styled.button`
  background-color: #f0f4f8;
  color: #4a90e2;
  border: none;
  border-radius: 20px;
  padding: 8px 15px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: #e1eaf5;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SendButton = styled.button`
  background-color: #0084ff;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 8px 15px;
  font-size: 14px;
  cursor: pointer;
  font-weight: 500;
  
  &:hover {
    background-color: #0077e6;
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const LoadingText = styled.div`
  padding: 20px;
  color: #888;
  text-align: center;
`;

const NoConversations = styled.div`
  padding: 20px;
  color: #888;
  text-align: center;
`;

const NoMessages = styled.div`
  padding: 20px;
  color: #888;
  text-align: center;
  font-style: italic;
`;

const NoConversationSelected = styled.div`
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #888;
  font-style: italic;
`;

const ErrorBanner = styled.div`
  background-color: #ffebee;
  color: #d32f2f;
  padding: 10px 15px;
  border-radius: 4px;
  margin-bottom: 15px;
  font-size: 14px;
`;

export default Messages; 
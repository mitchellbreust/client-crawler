import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import styled from 'styled-components';

const JobDetail = () => {
  const { jobId } = useParams();
  const navigate = useNavigate();
  
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [applyMessage, setApplyMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  useEffect(() => {
    const fetchJob = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/jobs/${jobId}`);
        setJob(response.data.job);
        setLoading(false);
      } catch (err) {
        setError('Failed to load job details. Please try again.');
        setLoading(false);
        console.error(err);
      }
    };
    
    fetchJob();
  }, [jobId]);
  
  const handleGenerateMessage = async () => {
    try {
      setIsGenerating(true);
      const response = await axios.post('/api/generate-message', {
        business_name: job.business_name,
        job_type: job.job_type || 'labour'
      });
      
      setApplyMessage(response.data.generated_message);
      setIsGenerating(false);
    } catch (err) {
      setError('Failed to generate message. Please try again.');
      setIsGenerating(false);
      console.error(err);
    }
  };
  
  const handleSendMessage = async () => {
    if (!applyMessage.trim()) {
      setError('Please enter a message to send.');
      return;
    }
    
    try {
      setIsSending(true);
      
      // First, create a conversation for this job
      const conversationResponse = await axios.post(`/api/jobs/${jobId}/conversation`);
      const conversationId = conversationResponse.data.conversation.id;
      
      // Then, send the message
      await axios.post(`/api/conversations/${conversationId}/messages`, {
        text: applyMessage,
        send_sms: true
      });
      
      // Navigate to conversation view
      navigate(`/conversations/${jobId}`);
    } catch (err) {
      setError('Failed to send message. Please try again.');
      setIsSending(false);
      console.error(err);
    }
  };
  
  if (loading) {
    return <LoadingMessage>Loading job details...</LoadingMessage>;
  }
  
  if (error) {
    return <ErrorMessage>{error}</ErrorMessage>;
  }
  
  if (!job) {
    return <ErrorMessage>Job not found.</ErrorMessage>;
  }
  
  return (
    <JobDetailContainer>
      <BackLink to="/jobs">← Back to Jobs</BackLink>
      
      <JobHeader>
        <h1>{job.business_name}</h1>
        <StatusBadge status={job.status}>
          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
        </StatusBadge>
      </JobHeader>
      
      <JobDetailsCard>
        <JobDetailsSection>
          <SectionTitle>Job Details</SectionTitle>
          <DetailRow>
            <DetailLabel>Job Type:</DetailLabel>
            <DetailValue>{job.job_type || 'General Labor'}</DetailValue>
          </DetailRow>
          <DetailRow>
            <DetailLabel>Phone:</DetailLabel>
            <DetailValue>{job.business_phone}</DetailValue>
          </DetailRow>
          {job.url && (
            <DetailRow>
              <DetailLabel>Website:</DetailLabel>
              <DetailValue>
                <a href={job.url} target="_blank" rel="noopener noreferrer">
                  {job.url}
                </a>
              </DetailValue>
            </DetailRow>
          )}
        </JobDetailsSection>
        
        <JobDetailsSection>
          <SectionTitle>Location</SectionTitle>
          {job.street && (
            <DetailRow>
              <DetailLabel>Street:</DetailLabel>
              <DetailValue>{job.street}</DetailValue>
            </DetailRow>
          )}
          {job.suburb && (
            <DetailRow>
              <DetailLabel>Suburb:</DetailLabel>
              <DetailValue>{job.suburb}</DetailValue>
            </DetailRow>
          )}
          {job.state && (
            <DetailRow>
              <DetailLabel>State:</DetailLabel>
              <DetailValue>{job.state}</DetailValue>
            </DetailRow>
          )}
          {job.postcode && (
            <DetailRow>
              <DetailLabel>Postcode:</DetailLabel>
              <DetailValue>{job.postcode}</DetailValue>
            </DetailRow>
          )}
        </JobDetailsSection>
      </JobDetailsCard>
      
      <MessageCard>
        <SectionTitle>Send Message to Apply</SectionTitle>
        {error && <ErrorMessage>{error}</ErrorMessage>}
        
        <MessageInput
          value={applyMessage}
          onChange={(e) => setApplyMessage(e.target.value)}
          placeholder="Enter your message here..."
          rows={6}
        />
        
        <ButtonRow>
          <GenerateButton 
            onClick={handleGenerateMessage} 
            disabled={isGenerating}
          >
            {isGenerating ? 'Generating...' : 'Generate Message with AI'}
          </GenerateButton>
          
          <SendButton 
            onClick={handleSendMessage} 
            disabled={isSending || !applyMessage.trim()}
          >
            {isSending ? 'Sending...' : 'Send Message'}
          </SendButton>
        </ButtonRow>
        
        <MessageHint>
          Your message will be sent as an SMS to the business phone number.
        </MessageHint>
      </MessageCard>
    </JobDetailContainer>
  );
};

// Styled Components
const JobDetailContainer = styled.div`
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
`;

const BackLink = styled(Link)`
  display: inline-block;
  margin-bottom: 20px;
  color: #4a90e2;
  font-size: 14px;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

const JobHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h1 {
    margin: 0;
    color: #333;
  }
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 5px 12px;
  border-radius: 16px;
  font-size: 14px;
  font-weight: 500;
  
  ${({ status }) => {
    switch (status) {
      case 'contacted':
        return `
          background-color: #e3f2fd;
          color: #1976d2;
        `;
      case 'interview':
        return `
          background-color: #e8f5e9;
          color: #2e7d32;
        `;
      case 'rejected':
        return `
          background-color: #ffebee;
          color: #c62828;
        `;
      case 'hired':
        return `
          background-color: #e8f5e9;
          color: #2e7d32;
        `;
      default:
        return `
          background-color: #f5f5f5;
          color: #616161;
        `;
    }
  }}
`;

const JobDetailsCard = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 30px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  
  @media (max-width: 600px) {
    grid-template-columns: 1fr;
  }
`;

const JobDetailsSection = styled.div``;

const SectionTitle = styled.h2`
  font-size: 18px;
  color: #333;
  margin-top: 0;
  margin-bottom: 15px;
  padding-bottom: 10px;
  border-bottom: 1px solid #eee;
`;

const DetailRow = styled.div`
  display: flex;
  margin-bottom: 10px;
`;

const DetailLabel = styled.div`
  width: 100px;
  font-weight: 500;
  color: #666;
`;

const DetailValue = styled.div`
  flex: 1;
  color: #333;
  
  a {
    color: #4a90e2;
    
    &:hover {
      text-decoration: underline;
    }
  }
`;

const MessageCard = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  padding: 20px;
`;

const MessageInput = styled.textarea`
  width: 100%;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  margin-bottom: 15px;
  resize: vertical;
  font-family: inherit;
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

const ButtonRow = styled.div`
  display: flex;
  gap: 10px;
  margin-bottom: 15px;
  
  @media (max-width: 500px) {
    flex-direction: column;
  }
`;

const GenerateButton = styled.button`
  background-color: #f5f5f5;
  color: #333;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #eeeeee;
  }
  
  &:disabled {
    background-color: #f5f5f5;
    color: #aaa;
    cursor: not-allowed;
  }
`;

const SendButton = styled.button`
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
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

const MessageHint = styled.div`
  font-size: 12px;
  color: #666;
  margin-top: 5px;
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
  margin-bottom: 20px;
`;

export default JobDetail; 
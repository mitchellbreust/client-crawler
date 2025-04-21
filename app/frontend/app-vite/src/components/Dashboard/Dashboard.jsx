import React, { useState, useEffect, useContext } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../../context/AuthContext';
import api, { jobsAPI } from '../../services/api';

const Dashboard = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const { user, token, loading: authLoading } = useContext(AuthContext);

  useEffect(() => {
    // Only fetch data when authentication is complete (not loading)
    // and we have a valid token
    if (authLoading || !token) {
      return;
    }

    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        console.log('Fetching dashboard data with token:', token);
        
        // Fetch jobs using our API service instead of global axios
        const jobsResponse = await jobsAPI.getJobs();
        
        // Sort by status (contacted first, then pending)
        const sortedJobs = jobsResponse.data.jobs.sort((a, b) => {
          if (a.status === 'contacted' && b.status !== 'contacted') return -1;
          if (a.status !== 'contacted' && b.status === 'contacted') return 1;
          return new Date(b.created_at) - new Date(a.created_at);
        });
        
        setJobs(sortedJobs);
        setLoading(false);
      } catch (err) {
        setError('Failed to load dashboard data. Please try again.');
        setLoading(false);
        console.error('Dashboard data fetch error:', err);
      }
    };

    fetchDashboardData();
  }, [token, authLoading]); // Add dependencies to re-run when auth state changes

  // Show loading state while authentication is still in progress
  if (authLoading) {
    return <LoadingMessage>Checking authentication...</LoadingMessage>;
  }

  return (
    <DashboardContainer>
      <DashboardHeader>
        <h1>Dashboard</h1>
        <WelcomeMessage>Welcome back, {user?.email}</WelcomeMessage>
      </DashboardHeader>

      {loading ? (
        <LoadingMessage>Loading dashboard data...</LoadingMessage>
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : (
        <DashboardContent>
          <DashboardSection>
            <SectionHeader>
              <h2>Job Applications</h2>
              <ViewAllLink to="/jobs">View All Jobs</ViewAllLink>
            </SectionHeader>
            
            {jobs.length === 0 ? (
              <EmptyState>
                <p>You haven't added any jobs yet.</p>
                <Link to="/jobs">
                  <Button>Add Your First Job</Button>
                </Link>
              </EmptyState>
            ) : (
              <JobList>
                {jobs.slice(0, 5).map((job) => (
                  <JobCard key={job.id}>
                    <JobInfo>
                      <h3>{job.business_name}</h3>
                      <JobType>{job.job_type || 'General Labor'}</JobType>
                      <JobLocation>
                        {[job.suburb, job.state].filter(Boolean).join(', ')}
                      </JobLocation>
                    </JobInfo>
                    <JobActions>
                      <StatusBadge status={job.status}>
                        {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                      </StatusBadge>
                      {job.has_conversation ? (
                        <ActionButton as={Link} to={`/messages/${job.id}`}>
                          Open Chat
                        </ActionButton>
                      ) : (
                        <ActionButton as={Link} to={`/jobs/${job.id}`}>
                          Apply
                        </ActionButton>
                      )}
                    </JobActions>
                  </JobCard>
                ))}
              </JobList>
            )}
          </DashboardSection>
          
          <DashboardSection>
            <SectionHeader>
              <h2>Quick Stats</h2>
            </SectionHeader>
            <StatsGrid>
              <StatCard>
                <StatValue>{jobs.length}</StatValue>
                <StatLabel>Total Jobs</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>
                  {jobs.filter(job => job.status === 'contacted').length}
                </StatValue>
                <StatLabel>Contacted</StatLabel>
              </StatCard>
              <StatCard>
                <StatValue>
                  {jobs.filter(job => job.has_conversation).length}
                </StatValue>
                <StatLabel>Active Conversations</StatLabel>
              </StatCard>
            </StatsGrid>
          </DashboardSection>
        </DashboardContent>
      )}
    </DashboardContainer>
  );
};

// Styled Components
const DashboardContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const DashboardHeader = styled.div`
  margin-bottom: 30px;
  
  h1 {
    margin: 0 0 10px 0;
    color: #333;
  }
`;

const WelcomeMessage = styled.p`
  color: #666;
  font-size: 16px;
  margin: 0;
`;

const DashboardContent = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: 30px;
  
  @media (min-width: 768px) {
    grid-template-columns: 2fr 1fr;
  }
`;

const DashboardSection = styled.section`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  padding: 20px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h2 {
    margin: 0;
    color: #333;
    font-size: 18px;
  }
`;

const ViewAllLink = styled(Link)`
  color: #4a90e2;
  font-size: 14px;
  font-weight: 500;
  
  &:hover {
    text-decoration: underline;
  }
`;

const JobList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const JobCard = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #eee;
  transition: box-shadow 0.2s;
  
  &:hover {
    box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  }
`;

const JobInfo = styled.div`
  flex: 1;
  
  h3 {
    margin: 0 0 5px 0;
    font-size: 16px;
    color: #333;
  }
`;

const JobType = styled.div`
  font-size: 14px;
  color: #666;
  margin-bottom: 5px;
`;

const JobLocation = styled.div`
  font-size: 12px;
  color: #888;
`;

const JobActions = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-items: flex-end;
`;

const StatusBadge = styled.span`
  display: inline-block;
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
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

const ActionButton = styled.button`
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 6px 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #3a7bd5;
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 30px 0;
  
  p {
    color: #666;
    margin-bottom: 20px;
  }
`;

const Button = styled.button`
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
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
`;

const StatCard = styled.div`
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  text-align: center;
`;

const StatValue = styled.div`
  font-size: 24px;
  font-weight: 700;
  color: #4a90e2;
  margin-bottom: 5px;
`;

const StatLabel = styled.div`
  font-size: 14px;
  color: #666;
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

export default Dashboard; 
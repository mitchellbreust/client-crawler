import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../../context/AuthContext';
import api, { jobsAPI } from '../../services/api';

const JobList = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [formData, setFormData] = useState({
    business_name: '',
    business_phone: '',
    job_type: '',
    suburb: '',
    state: '',
    postcode: ''
  });
  const [formError, setFormError] = useState('');
  const [searchFormData, setSearchFormData] = useState({
    what: '',  // Type of business (e.g., plumber)
    where: '', // Location (e.g., cairns)
    state: 'qld' // Default to Queensland
  });
  const [searchError, setSearchError] = useState('');
  const [activeSearches, setActiveSearches] = useState([]);
  const [expandedSearches, setExpandedSearches] = useState({});
  const searchStatusIntervalRef = useRef(null);
  
  const { token, loading: authLoading } = useContext(AuthContext);

  useEffect(() => {
    // Only fetch jobs when auth is complete and token exists
    if (authLoading || !token) {
      return;
    }
    
    fetchJobs();
    fetchSearchStatus();
  }, [token, authLoading]);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (searchStatusIntervalRef.current) {
        clearInterval(searchStatusIntervalRef.current);
      }
    };
  }, []);

  // Set up polling for search status
  useEffect(() => {
    // Clear any existing interval
    if (searchStatusIntervalRef.current) {
      clearInterval(searchStatusIntervalRef.current);
    }
    
    // Check for active searches
    const hasActiveSearch = activeSearches.some(search => search.status === 'in_progress');
    
    if (hasActiveSearch) {
      // Set up polling if there are active searches
      searchStatusIntervalRef.current = setInterval(fetchSearchStatus, 3000);
    } else {
      searchStatusIntervalRef.current = null;
    }
    
    return () => {
      if (searchStatusIntervalRef.current) {
        clearInterval(searchStatusIntervalRef.current);
      }
    };
  }, [activeSearches]);

  const fetchJobs = async () => {
    try {
      setLoading(true);
      console.log('Fetching jobs with token:', token);
      // Use jobsAPI instead of axios
      const response = await jobsAPI.getJobs();
      setJobs(response.data.jobs);
      setLoading(false);
    } catch (err) {
      setError('Failed to load jobs. Please try again.');
      setLoading(false);
      console.error('Job fetch error:', err);
    }
  };

  const fetchSearchStatus = async () => {
    try {
      const response = await jobsAPI.getSearchStatus();
      if (response.data.searches) {
        // Update the active searches
        setActiveSearches(response.data.searches);
        
        // Check if any completed searches
        const completedSearch = response.data.searches.find(search => 
          search.status === 'completed' && search.progress === 100);
        
        // Refresh job list if a search just completed
        if (completedSearch) {
          fetchJobs();
        }
      }
    } catch (err) {
      console.error('Error checking search status:', err);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSearchChange = (e) => {
    setSearchFormData({
      ...searchFormData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    // Validate form
    if (!formData.business_name || !formData.business_phone) {
      setFormError('Business name and phone are required');
      return;
    }

    try {
      // Use jobsAPI instead of axios
      await jobsAPI.createJob(formData);
      
      // Reset form and hide it
      setFormData({
        business_name: '',
        business_phone: '',
        job_type: '',
        suburb: '',
        state: '',
        postcode: ''
      });
      setShowForm(false);
      
      // Refresh jobs list
      fetchJobs();
    } catch (err) {
      if (err.response && err.response.status === 409) {
        setFormError('A job with this business name and phone already exists');
      } else {
        setFormError('Failed to create job. Please try again.');
      }
      console.error(err);
    }
  };

  const handleSearchSubmit = async (e) => {
    e.preventDefault();
    setSearchError('');

    // Validate form
    if (!searchFormData.what || !searchFormData.where || !searchFormData.state) {
      setSearchError('All fields are required');
      return;
    }

    try {
      const response = await jobsAPI.searchJobs(searchFormData);
      
      // Update search status and fetch all statuses
      fetchSearchStatus();
      
      // Reset search form
      setSearchFormData({
        what: '',
        where: '',
        state: 'qld'
      });
      
      // Hide the form
      setShowSearchForm(false);
    } catch (err) {
      setSearchError('Failed to start job search. Please try again.');
      console.error(err);
    }
  };

  const handleDeleteJob = async (jobId) => {
    if (!window.confirm('Are you sure you want to delete this job?')) {
      return;
    }

    try {
      // Use jobsAPI instead of axios
      await jobsAPI.deleteJob(jobId);
      
      // Update local state
      setJobs(jobs.filter(job => job.id !== jobId));
    } catch (err) {
      setError('Failed to delete job. Please try again.');
      console.error(err);
    }
  };

  const toggleSearchResults = (searchId) => {
    setExpandedSearches(prev => ({
      ...prev,
      [searchId]: !prev[searchId]
    }));
  };

  // Show loading state while authentication is in progress
  if (authLoading) {
    return <LoadingMessage>Checking authentication...</LoadingMessage>;
  }

  const formatCreatedAt = (isoDate) => {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleString();
  };

  return (
    <JobListContainer>
      <ListHeader>
        <h1>Job Listings</h1>
        <ButtonGroup>
          <ActionButton onClick={() => {
            setShowSearchForm(!showSearchForm);
            setShowForm(false);
          }}>
            {showSearchForm ? 'Cancel Search' : 'Search Jobs'}
          </ActionButton>
          <AddButton onClick={() => {
            setShowForm(!showForm);
            setShowSearchForm(false);
          }}>
            {showForm ? 'Cancel' : 'Add Job'}
          </AddButton>
        </ButtonGroup>
      </ListHeader>

      {/* Active Searches Display */}
      {activeSearches.length > 0 && (
        <SearchListContainer>
          <h2>Recent Searches</h2>
          <SearchList>
            {activeSearches.map((search) => (
              <SearchItem key={search.id} status={search.status}>
                <SearchHeader>
                  <SearchTitle>
                    {search.what} in {search.where}, {search.state}
                  </SearchTitle>
                  <SearchStatus status={search.status}>
                    {search.status.charAt(0).toUpperCase() + search.status.slice(1)}
                  </SearchStatus>
                </SearchHeader>
                
                <SearchInfo>
                  <div>Started: {formatCreatedAt(search.created_at)}</div>
                  {search.results_count && (
                    <div>Businesses found: {search.results_count}</div>
                  )}
                  {search.jobs_imported >= 0 && (
                    <div>New jobs imported: {search.jobs_imported}</div>
                  )}
                </SearchInfo>
                
                <SearchMessage>{search.message}</SearchMessage>
                
                {search.status === 'in_progress' && (
                  <ProgressBar>
                    <Progress width={search.progress} />
                  </ProgressBar>
                )}

                {/* Add business results display */}
                {search.status === 'completed' && search.results && search.results.length > 0 && (
                  <BusinessResultsContainer>
                    <BusinessResultsToggle
                      onClick={() => toggleSearchResults(search.id)}
                    >
                      {search.results.length} Businesses Found - Click to {expandedSearches[search.id] ? 'Hide' : 'Show'}
                    </BusinessResultsToggle>
                    <BusinessResults style={{display: expandedSearches[search.id] ? 'block' : 'none'}}>
                      {search.results.map((business, index) => (
                        <BusinessCardItem key={index}>
                          <BusinessNameText>{business.name}</BusinessNameText>
                          <BusinessPhoneText>{business.phone}</BusinessPhoneText>
                          {business.suburb && business.state && (
                            <BusinessLocationText>
                              {business.suburb}, {business.state} {business.postcode}
                            </BusinessLocationText>
                          )}
                          {business.street && (
                            <BusinessLocationText>{business.street}</BusinessLocationText>
                          )}
                          {business.url && (
                            <BusinessUrlLink href={business.url} target="_blank" rel="noopener noreferrer">
                              View Website
                            </BusinessUrlLink>
                          )}
                        </BusinessCardItem>
                      ))}
                    </BusinessResults>
                  </BusinessResultsContainer>
                )}
              </SearchItem>
            ))}
          </SearchList>
        </SearchListContainer>
      )}

      {/* Web Scraping Search Form */}
      {showSearchForm && (
        <FormContainer>
          <h2>Search for Jobs</h2>
          
          {searchError && <ErrorMessage>{searchError}</ErrorMessage>}
          
          <Form onSubmit={handleSearchSubmit}>
            <FormGroup>
              <label htmlFor="what">Job Type *</label>
              <input
                type="text"
                id="what"
                name="what"
                value={searchFormData.what}
                onChange={handleSearchChange}
                placeholder="e.g. plumber, electrician, carpenter"
                required
              />
              <FieldHint>Type of business to search for</FieldHint>
            </FormGroup>
            
            <FormGroup>
              <label htmlFor="where">Location *</label>
              <input
                type="text"
                id="where"
                name="where"
                value={searchFormData.where}
                onChange={handleSearchChange}
                placeholder="e.g. cairns, townsville, brisbane"
                required
              />
              <FieldHint>City or suburb name</FieldHint>
            </FormGroup>
            
            <FormGroup>
              <label htmlFor="state">State *</label>
              <select
                id="state"
                name="state"
                value={searchFormData.state}
                onChange={handleSearchChange}
                required
              >
                <option value="qld">Queensland</option>
                <option value="nsw">New South Wales</option>
                <option value="vic">Victoria</option>
                <option value="sa">South Australia</option>
                <option value="wa">Western Australia</option>
                <option value="tas">Tasmania</option>
                <option value="act">Australian Capital Territory</option>
                <option value="nt">Northern Territory</option>
              </select>
            </FormGroup>
            
            <SubmitButton type="submit">Start Search</SubmitButton>
            
            <SearchInfo>
              This will search for businesses of the specified type in the given location,
              and automatically import them into your job list. The search may take a few minutes.
            </SearchInfo>
          </Form>
        </FormContainer>
      )}

      {/* Manual Job Add Form */}
      {showForm && (
        <FormContainer>
          <h2>Add New Job</h2>
          
          {formError && <ErrorMessage>{formError}</ErrorMessage>}
          
          <Form onSubmit={handleSubmit}>
            <FormGroup>
              <label htmlFor="business_name">Business Name *</label>
              <input
                type="text"
                id="business_name"
                name="business_name"
                value={formData.business_name}
                onChange={handleChange}
                required
              />
            </FormGroup>
            
            <FormGroup>
              <label htmlFor="business_phone">Phone Number *</label>
              <input
                type="tel"
                id="business_phone"
                name="business_phone"
                value={formData.business_phone}
                onChange={handleChange}
                placeholder="+61XXXXXXXXX"
                required
              />
            </FormGroup>
            
            <FormRow>
              <FormGroup>
                <label htmlFor="job_type">Job Type</label>
                <input
                  type="text"
                  id="job_type"
                  name="job_type"
                  value={formData.job_type}
                  onChange={handleChange}
                  placeholder="e.g. Plumber, Electrician"
                />
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="suburb">Suburb</label>
                <input
                  type="text"
                  id="suburb"
                  name="suburb"
                  value={formData.suburb}
                  onChange={handleChange}
                />
              </FormGroup>
            </FormRow>
            
            <FormRow>
              <FormGroup>
                <label htmlFor="state">State</label>
                <input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                  placeholder="e.g. QLD"
                />
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="postcode">Postcode</label>
                <input
                  type="text"
                  id="postcode"
                  name="postcode"
                  value={formData.postcode}
                  onChange={handleChange}
                />
              </FormGroup>
            </FormRow>
            
            <SubmitButton type="submit">Add Job</SubmitButton>
          </Form>
        </FormContainer>
      )}

      {loading ? (
        <LoadingMessage>Loading jobs...</LoadingMessage>
      ) : error ? (
        <ErrorMessage>{error}</ErrorMessage>
      ) : jobs.length === 0 ? (
        <EmptyState>
          <p>You haven't added any jobs yet.</p>
          <ButtonGroup>
            <ActionButton onClick={() => setShowSearchForm(true)}>Search for Jobs</ActionButton>
            <AddButton onClick={() => setShowForm(true)}>Add Job Manually</AddButton>
          </ButtonGroup>
        </EmptyState>
      ) : (
        <JobsTable>
          <thead>
            <tr>
              <th>Business</th>
              <th>Job Type</th>
              <th>Location</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id}>
                <td>
                  <BusinessName>{job.business_name}</BusinessName>
                  <BusinessPhone>{job.business_phone}</BusinessPhone>
                </td>
                <td>{job.job_type || 'General Labor'}</td>
                <td>
                  {[job.suburb, job.state, job.postcode].filter(Boolean).join(', ')}
                </td>
                <td>
                  <StatusBadge status={job.status}>
                    {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                  </StatusBadge>
                </td>
                <td>
                  <ActionButtons>
                    {job.has_conversation ? (
                      <ViewButton as={Link} to={`/conversations/${job.id}`}>
                        Messages
                      </ViewButton>
                    ) : (
                      <ViewButton as={Link} to={`/jobs/${job.id}`}>
                        Apply
                      </ViewButton>
                    )}
                    <DeleteButton onClick={() => handleDeleteJob(job.id)}>
                      Delete
                    </DeleteButton>
                  </ActionButtons>
                </td>
              </tr>
            ))}
          </tbody>
        </JobsTable>
      )}
    </JobListContainer>
  );
};

// Styled Components
const JobListContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
`;

const ListHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h1 {
    margin: 0;
    color: #333;
  }
`;

const ButtonGroup = styled.div`
  display: flex;
  gap: 10px;
`;

const AddButton = styled.button`
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

const ActionButton = styled.button`
  background-color: #5cb85c;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #4cae4c;
  }
`;

const SearchListContainer = styled.div`
  margin-bottom: 30px;
  
  h2 {
    font-size: 18px;
    margin-bottom: 15px;
    color: #333;
  }
`;

const SearchList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const SearchItem = styled.div`
  background-color: ${props => {
    switch (props.status) {
      case 'completed': return '#dff0d8';
      case 'failed': return '#f2dede';
      default: return '#d9edf7';
    }
  }};
  border: 1px solid ${props => {
    switch (props.status) {
      case 'completed': return '#d6e9c6';
      case 'failed': return '#ebccd1';
      default: return '#bce8f1';
    }
  }};
  color: ${props => {
    switch (props.status) {
      case 'completed': return '#3c763d';
      case 'failed': return '#a94442';
      default: return '#31708f';
    }
  }};
  border-radius: 8px;
  padding: 15px;
`;

const SearchHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
`;

const SearchTitle = styled.h3`
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`;

const SearchStatus = styled.span`
  padding: 3px 8px;
  border-radius: 12px;
  font-size: 12px;
  background-color: ${props => {
    switch (props.status) {
      case 'completed': return '#3c763d';
      case 'failed': return '#a94442';
      default: return '#31708f';
    }
  }};
  color: white;
`;

const SearchMessage = styled.div`
  margin: 10px 0;
`;

const ProgressBar = styled.div`
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
  height: 10px;
  overflow: hidden;
  margin-top: 15px;
`;

const Progress = styled.div`
  background-color: #4a90e2;
  height: 100%;
  width: ${props => props.width}%;
  transition: width 0.3s ease;
`;

const FormContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 30px;
  
  h2 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 18px;
    color: #333;
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const FormGroup = styled.div`
  flex: 1;
  
  label {
    display: block;
    margin-bottom: 5px;
    font-weight: 500;
    color: #555;
  }
  
  input, select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-size: 14px;
    
    &:focus {
      outline: none;
      border-color: #4a90e2;
    }
  }
`;

const FieldHint = styled.div`
  font-size: 12px;
  color: #777;
  margin-top: 5px;
`;

const SearchInfo = styled.div`
  font-size: 13px;
  margin-top: 15px;
  color: #666;
  background-color: #f9f9f9;
  padding: 10px;
  border-radius: 4px;
  line-height: 1.4;
`;

const FormRow = styled.div`
  display: flex;
  gap: 15px;
  
  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const SubmitButton = styled.button`
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 12px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #3a7bd5;
  }
`;

const JobsTable = styled.table`
  width: 100%;
  border-collapse: collapse;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  
  th, td {
    padding: 15px;
    text-align: left;
  }
  
  th {
    background-color: #f5f5f5;
    color: #333;
    font-weight: 600;
    font-size: 14px;
  }
  
  tr:not(:last-child) {
    border-bottom: 1px solid #eee;
  }
  
  tbody tr:hover {
    background-color: #f9f9f9;
  }
`;

const BusinessName = styled.div`
  font-weight: 500;
  color: #333;
  margin-bottom: 5px;
`;

const BusinessPhone = styled.div`
  font-size: 12px;
  color: #666;
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

const ActionButtons = styled.div`
  display: flex;
  gap: 8px;
`;

const ViewButton = styled.button`
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: #3a7bd5;
  }
`;

const DeleteButton = styled.button`
  background-color: #f5f5f5;
  color: #e53935;
  border: 1px solid #e53935;
  border-radius: 4px;
  padding: 5px 10px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #ffebee;
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
  margin-bottom: 20px;
`;

const EmptyState = styled.div`
  text-align: center;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  padding: 40px 20px;
  
  p {
    color: #666;
    margin-bottom: 20px;
  }
`;

const BusinessResultsContainer = styled.div`
  margin-top: 15px;
  border-top: 1px solid rgba(0, 0, 0, 0.1);
  padding-top: 15px;
`;

const BusinessResultsToggle = styled.button`
  background: none;
  border: none;
  color: inherit;
  font-weight: 600;
  cursor: pointer;
  padding: 5px 0;
  text-align: left;
  width: 100%;
  
  &:hover {
    text-decoration: underline;
  }
`;

const BusinessResults = styled.div`
  margin-top: 10px;
  max-height: 300px;
  overflow-y: auto;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
`;

const BusinessCardItem = styled.div`
  padding: 10px;
  margin-bottom: 10px;
  border-radius: 4px;
  background-color: white;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
`;

const BusinessNameText = styled.div`
  font-weight: 600;
  margin-bottom: 5px;
`;

const BusinessPhoneText = styled.div`
  font-size: 13px;
  margin-bottom: 5px;
`;

const BusinessLocationText = styled.div`
  font-size: 12px;
  color: #666;
  margin-bottom: 3px;
`;

const BusinessUrlLink = styled.a`
  font-size: 12px;
  color: #4a90e2;
  text-decoration: none;
  display: block;
  margin-top: 5px;
  
  &:hover {
    text-decoration: underline;
  }
`;

export default JobList; 
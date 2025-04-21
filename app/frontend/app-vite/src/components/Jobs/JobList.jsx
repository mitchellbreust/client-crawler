import React, { useState, useEffect, useContext, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { AuthContext } from '../../context/AuthContext';
import api, { jobsAPI, conversationsAPI } from '../../services/api';

const JobList = () => {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [batchMessageText, setBatchMessageText] = useState('');
  const [useGenericMessage, setUseGenericMessage] = useState(false);
  const [showBatchMessageForm, setShowBatchMessageForm] = useState(false);
  const [isSendingBatch, setIsSendingBatch] = useState(false);
  const [filters, setFilters] = useState({
    jobType: '',
    location: '',
    phonePrefix: ''
  });
  const [showFilters, setShowFilters] = useState(true);
  const [filteredJobs, setFilteredJobs] = useState([]);
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

  useEffect(() => {
    // Apply filters whenever jobs or filter values change
    if (jobs.length > 0) {
      applyFilters();
    } else {
      setFilteredJobs([]);
    }
  }, [jobs, filters]);

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
      const response = await jobsAPI.getJobs();
      setJobs(response.data.jobs);
      setFilteredJobs(response.data.jobs); // Initialize filteredJobs with all jobs
      setLoading(false);
    } catch (error) {
      setError('Failed to load jobs. Please try again.');
      setLoading(false);
      console.error(error);
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

  // Add a function to handle job selection
  const handleSelectJob = (jobId) => {
    if (selectedJobs.includes(jobId)) {
      setSelectedJobs(selectedJobs.filter(id => id !== jobId));
    } else {
      setSelectedJobs([...selectedJobs, jobId]);
    }
  };

  // Add a function to handle selecting/deselecting all eligible jobs
  const handleSelectAllJobs = () => {
    // If all eligible jobs are already selected, deselect them all
    const eligibleJobs = filteredJobs.filter(job => !job.has_conversation && job.status === 'pending').map(job => job.id);
    
    if (eligibleJobs.length === 0) {
      // No eligible jobs to select
      return;
    }
    
    // Check if all eligible jobs are already selected
    const allSelected = eligibleJobs.every(id => selectedJobs.includes(id));
    
    if (allSelected) {
      // Deselect all filtered jobs
      setSelectedJobs(selectedJobs.filter(id => !eligibleJobs.includes(id)));
    } else {
      // Select all eligible filtered jobs
      const newSelectedJobs = [...selectedJobs];
      eligibleJobs.forEach(id => {
        if (!newSelectedJobs.includes(id)) {
          newSelectedJobs.push(id);
        }
      });
      setSelectedJobs(newSelectedJobs);
    }
  };

  // Generate message for all selected jobs
  const handleGenerateBatchMessage = async () => {
    if (selectedJobs.length === 0) return;
    
    try {
      // Use the first selected job for message generation
      const firstJobId = selectedJobs[0];
      const job = jobs.find(job => job.id === firstJobId);
      
      if (!job) return;
      
      const response = await conversationsAPI.generateMessage({
        business_name: job.business_name,
        job_type: job.job_type || 'labour'
      });
      
      setBatchMessageText(response.data.generated_message);
    } catch (err) {
      setError('Failed to generate message. Please try again.');
      console.error(err);
    }
  };

  // Send messages to all selected jobs
  const handleSendBatchMessages = async () => {
    if (selectedJobs.length === 0) {
      setError('Please select at least one job');
      return;
    }
    if (useGenericMessage && !batchMessageText.trim()) {
      setError('Please enter a generic message');
      return;
    }

    setIsSendingBatch(true);
    try {
      const results = [];
      for (const jobId of selectedJobs) {
        try {
          const job = jobs.find(j => j.id === jobId);
          if (!job) throw new Error('Job not found');
          let msgText;
          if (useGenericMessage) {
            msgText = batchMessageText;
          } else {
            const gen = await conversationsAPI.generateMessage({
              business_name: job.business_name,
              job_type: job.job_type || 'labour',
              extra_context: batchMessageText.trim()
            });
            msgText = gen.data.generated_message;
          }

          // Create or reuse conversation
          const convResp = await conversationsAPI.createConversation(jobId);
          const convId = convResp.data.conversation.id;
          // Send via backend (httpssms or Twilio based on settings)
          await conversationsAPI.createMessage(convId, {
            text: msgText,
            send_sms: true
          });
          // Wait 10 second between messages to prevent rate limiting
          await new Promise(resolve => setTimeout(resolve, 10000));
          results.push({ jobId, success: true });
        } catch (err) {
          console.error(`Error sending to job ${jobId}:`, err);
          results.push({ jobId, success: false, error: err });
        }
      }
      const successCount = results.filter(r => r.success).length;
      alert(`Sent messages to ${successCount} of ${selectedJobs.length} jobs.`);
      setSelectedJobs([]);
      setBatchMessageText('');
      setShowBatchMessageForm(false);
      fetchJobs();
      if (successCount > 0) navigate('/messages');
    } catch (err) {
      setError('Batch messaging failed.');
    } finally {
      setIsSendingBatch(false);
    }
  };

  // Handle filter input changes
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Apply filters to jobs
  const applyFilters = () => {
    let result = [...jobs];
    
    // Filter by job type if provided
    if (filters.jobType.trim()) {
      result = result.filter(job => 
        job.job_type?.toLowerCase().includes(filters.jobType.toLowerCase())
      );
    }
    
    // Filter by location if provided
    if (filters.location.trim()) {
      result = result.filter(job => {
        const jobLocation = [job.suburb, job.state, job.postcode].filter(Boolean).join(' ').toLowerCase();
        return jobLocation.includes(filters.location.toLowerCase());
      });
    }
    
    // Filter by phone prefix if provided
    if (filters.phonePrefix.trim()) {
      result = result.filter(job => 
        job.business_phone.startsWith(filters.phonePrefix)
      );
    }
    
    setFilteredJobs(result);
  };

  // Clear all filters
  const clearFilters = () => {
    setFilters({
      jobType: '',
      location: '',
      phonePrefix: ''
    });
  };

  return (
    <JobListContainer>
      <ListHeader>
        <h1>Job Listings</h1>
        <ButtonGroup>
          <ActionButton onClick={() => setShowSearchForm(!showSearchForm)} style={{ backgroundColor: showSearchForm ? 'red' : '#5cb85c'}}>
            {showSearchForm ? 'Hide Search Form' : 'Auto Search'}
          </ActionButton>
          <AddButton onClick={() => {
            setShowForm(!showForm);
            setShowSearchForm(false);
          }}
            style={{ backgroundColor: showForm ? 'red' : '#4a90e2' }}
          >
            {showForm ? 'Cancel' : 'Add Job Manually'}
          </AddButton>
        </ButtonGroup>
      </ListHeader>

      {/* Web Scraping Search Form - toggled above the job listing */}
      {showSearchForm && (
        <SearchFormContainer>
          <SectionTitle>Find Jobs</SectionTitle>
          <SearchForm onSubmit={handleSearchSubmit}>
            {searchError && <SearchErrorMessage>{searchError}</SearchErrorMessage>}
            
            <SearchFormRow>
              <SearchFormGroup>
                <label htmlFor="what">Business Type</label>
                <SearchInput
                  type="text"
                  id="what"
                  name="what"
                  value={searchFormData.what}
                  onChange={handleSearchChange}
                  placeholder="e.g., plumber, electrician"
                />
              </SearchFormGroup>
              
              <SearchFormGroup>
                <label htmlFor="where">Location</label>
                <SearchInput
                  type="text"
                  id="where"
                  name="where"
                  value={searchFormData.where}
                  onChange={handleSearchChange}
                  placeholder="e.g., cairns, brisbane"
                />
              </SearchFormGroup>
              
              <SearchFormGroup>
                <label htmlFor="state">State</label>
                <SearchSelect
                  id="state"
                  name="state"
                  value={searchFormData.state}
                  onChange={handleSearchChange}
                >
                  <option value="qld">Queensland</option>
                  <option value="nsw">New South Wales</option>
                  <option value="vic">Victoria</option>
                  <option value="sa">South Australia</option>
                  <option value="wa">Western Australia</option>
                  <option value="tas">Tasmania</option>
                  <option value="act">ACT</option>
                  <option value="nt">Northern Territory</option>
                </SearchSelect>
              </SearchFormGroup>
              
              <SearchButtonContainer>
                <SearchButton type="submit">Search</SearchButton>
              </SearchButtonContainer>
            </SearchFormRow>
          </SearchForm>
        </SearchFormContainer>
      )}

      {/* Manual Job Form - moved above the job listing */}
      {showForm && (
        <FormContainer>
          <h2>Add New Job</h2>
          {formError && <ErrorMessage>{formError}</ErrorMessage>}
          
          <Form onSubmit={handleSubmit}>
            <FormRow>
              <FormGroup>
                <label htmlFor="business_name">Business Name *</label>
                <Input
                  type="text"
                  id="business_name"
                  name="business_name"
                  value={formData.business_name}
                  onChange={handleChange}
                  required
                />
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="business_phone">Phone *</label>
                <Input
                  type="text"
                  id="business_phone"
                  name="business_phone"
                  value={formData.business_phone}
                  onChange={handleChange}
                  required
                />
              </FormGroup>
            </FormRow>
            
            <FormRow>
              <FormGroup>
                <label htmlFor="job_type">Job Type</label>
                <Input
                  type="text"
                  id="job_type"
                  name="job_type"
                  value={formData.job_type}
                  onChange={handleChange}
                  placeholder="e.g., Plumbing, Electrical"
                />
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="url">Website URL</label>
                <Input
                  type="text"
                  id="url"
                  name="url"
                  value={formData.url}
                  onChange={handleChange}
                />
              </FormGroup>
            </FormRow>
            
            <FormRow>
              <FormGroup>
                <label htmlFor="street">Street Address</label>
                <Input
                  type="text"
                  id="street"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                />
              </FormGroup>
            </FormRow>
            
            <FormRow>
              <FormGroup>
                <label htmlFor="suburb">Suburb</label>
                <Input
                  type="text"
                  id="suburb"
                  name="suburb"
                  value={formData.suburb}
                  onChange={handleChange}
                />
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="state">State</label>
                <Input
                  type="text"
                  id="state"
                  name="state"
                  value={formData.state}
                  onChange={handleChange}
                />
              </FormGroup>
              
              <FormGroup>
                <label htmlFor="postcode">Postcode</label>
                <Input
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

      {/* Active Searches Display */}
      {activeSearches.length > 0 && (
        <ActiveSearchesContainer>
          <SectionTitle>Recent Searches</SectionTitle>
          {activeSearches.map((search) => (
            <SearchItem key={search.id}>
              <SearchHeader onClick={() => toggleSearchResults(search.id)}>
                <SearchInfo>
                  <SearchTitle>
                    {search.what} in {search.where}, {search.state.toUpperCase()}
                  </SearchTitle>
                  <SearchDate>{formatCreatedAt(search.created_at)}</SearchDate>
                </SearchInfo>
                <SearchStatus status={search.status}>
                  {search.status === 'running' ? 'In Progress' : 
                   search.status === 'completed' ? 'Completed' : 
                   search.status === 'error' ? 'Error' : 'Pending'}
                  {search.status === 'running' && 
                    <ProgressIndicator value={search.progress} max="100" />
                  }
                </SearchStatus>
              </SearchHeader>
              
              {expandedSearches[search.id] && search.status === 'completed' && (
                <SearchResults>
                  <ResultStats>
                    Found {search.results_count || 0} businesses, 
                    imported {search.jobs_imported || 0} new jobs
                  </ResultStats>
                </SearchResults>
              )}
            </SearchItem>
          ))}
        </ActiveSearchesContainer>
      )}

      {/* Filter Toggle Button - positioned below active searches */}
      
      {/* Filters section */}
      {showFilters && (
        <FiltersContainer>
          <FilterInputGroup>
            <FilterLabel>Job Type</FilterLabel>
            <FilterInput 
              type="text" 
              name="jobType" 
              value={filters.jobType} 
              onChange={handleFilterChange}
              placeholder="E.g. plumber, electrician"
            />
          </FilterInputGroup>
          
          <FilterInputGroup>
            <FilterLabel>Location</FilterLabel>
            <FilterInput 
              type="text" 
              name="location" 
              value={filters.location} 
              onChange={handleFilterChange}
              placeholder="Suburb, state or postcode"
            />
          </FilterInputGroup>
          
          <FilterInputGroup>
            <FilterLabel>Phone Prefix</FilterLabel>
            <FilterInput 
              type="text" 
              name="phonePrefix" 
              value={filters.phonePrefix} 
              onChange={handleFilterChange}
              placeholder="E.g. 04"
            />
          </FilterInputGroup>
          
          <FilterButtonGroup>
            <ClearFilterButton onClick={clearFilters}>
              Clear Filters
            </ClearFilterButton>
          </FilterButtonGroup>
          
          <FilterStats>
            Showing {filteredJobs.length} of {jobs.length} jobs
          </FilterStats>
        </FiltersContainer>
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
        <>
          <JobsTable>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <SelectAllContainer>
                    <SelectAllButton 
                      onClick={handleSelectAllJobs}
                      $isActive={filteredJobs.filter(job => !job.has_conversation && job.status === 'pending').length > 0}
                      title="Select/deselect all eligible jobs"
                    >
                      {selectedJobs.length === filteredJobs.filter(job => !job.has_conversation && job.status === 'pending').length 
                        && selectedJobs.length > 0 ? 'Deselect All' : 'Select All'}
                    </SelectAllButton>
                  </SelectAllContainer>
                </th>
                <th>Business</th>
                <th>Job Type</th>
                <th>Location</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job.id}>
                  <td>
                    {!job.has_conversation && job.status === 'pending' && (
                      <Checkbox
                        type="checkbox"
                        checked={selectedJobs.includes(job.id)}
                        onChange={() => handleSelectJob(job.id)}
                      />
                    )}
                  </td>
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
                        <ViewButton as={Link} to={`/messages/${job.id}`}>
                          Messages
                        </ViewButton>
                      ) : (
                        <ViewButton as={Link} to={`/jobs/${job.id}`}>
                          View
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

          {/* Batch message form (appears when "Send Messages" is clicked) */}
          {showBatchMessageForm && (
            <BatchMessageFormOverlay>
              <BatchMessageForm>
                <h2>Send Messages to Selected Jobs ({selectedJobs.length})</h2>
                {error && <ErrorMessage>{error}</ErrorMessage>}
                
                <FormGroup>
                  <label htmlFor="useGenericMessage">
                    <Checkbox
                      type="checkbox"
                      id="useGenericMessage"
                      checked={useGenericMessage}
                      onChange={() => setUseGenericMessage(!useGenericMessage)}
                    />
                    Send generic message to all selected businesses (skip AI)
                  </label>
                </FormGroup>
                <BatchMessageTextarea
                  value={batchMessageText}
                  onChange={(e) => setBatchMessageText(e.target.value)}
                  placeholder={useGenericMessage
                    ? 'Enter the message to send to all selected businesses'
                    : 'Optional extra context to customize each message'
                  }
                  rows={4}
                />
                
                <BatchFormButtonGroup>
                  <BatchFormActionButtons>
                    <CancelButton onClick={() => setShowBatchMessageForm(false)} disabled={isSendingBatch}>
                      Cancel
                    </CancelButton>
                    <SendButton
                      onClick={handleSendBatchMessages}
                      disabled={isSendingBatch || selectedJobs.length === 0 || (useGenericMessage && !batchMessageText.trim())}
                    >
                      {isSendingBatch && <Spinner />}{useGenericMessage ? 'Batch Send Messages' : 'Batch Send AI Messages'}
                    </SendButton>
                  </BatchFormActionButtons>
                </BatchFormButtonGroup>
              </BatchMessageForm>
            </BatchMessageFormOverlay>
          )}

          {/* Fixed batch message button (if jobs are selected) */}
          {selectedJobs.length > 0 && !showBatchMessageForm && (
            <BatchMessageButton onClick={() => setShowBatchMessageForm(true)}>
              Send Messages ({selectedJobs.length})
            </BatchMessageButton>
          )}
        </>
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
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 10px;
`;

const SearchHeader = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
`;

const SearchTitle = styled.div`
  font-weight: 500;
  font-size: 14px;
  color: #333;
`;

const SearchDate = styled.div`
  font-size: 12px;
  color: #666;
  margin-top: 4px;
`;

const SearchStatus = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 500;
  color: ${props => {
    switch (props.status) {
      case 'running': return '#1976d2';
      case 'completed': return '#2e7d32';
      case 'error': return '#c62828';
      default: return '#666';
    }
  }};
`;

const ProgressIndicator = styled.progress`
  width: 60px;
`;

const SearchResults = styled.div`
  margin-top: 10px;
  padding: 10px;
  background-color: rgba(255, 255, 255, 0.7);
  border-radius: 4px;
`;

const ResultStats = styled.div`
  font-size: 12px;
  color: #666;
`;

const FilterToggleWrapper = styled.div`
  margin-bottom: 20px;
  text-align: left;
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

// Add new styled components for batch messaging
const Checkbox = styled.input`
  width: 18px;
  height: 18px;
  cursor: pointer;
`;

const BatchMessageButton = styled.button`
  position: fixed;
  bottom: 20px;
  left: 20px;
  background-color: #4a90e2;
  color: white;
  border: none;
  border-radius: 30px;
  padding: 12px 24px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  transition: all 0.2s;
  
  &:hover {
    background-color: #3a7bd5;
    transform: translateY(-2px);
  }
`;

const BatchMessageFormOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const BatchMessageForm = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  padding: 24px;
  width: 90%;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  
  h2 {
    margin-top: 0;
    margin-bottom: 20px;
    font-size: 20px;
    color: #333;
  }
`;

const BatchMessageTextarea = styled.textarea`
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

const BatchFormButtonGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const BatchFormActionButtons = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
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

const CancelButton = styled.button`
  background-color: transparent;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 10px 16px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background-color: #f5f5f5;
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

const SelectAllContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding-bottom: 4px;
`;

const SelectAllButton = styled.button`
  background-color: ${props => props.$isActive ? '#4a90e2' : '#f5f5f5'};
  color: ${props => props.$isActive ? 'white' : '#333'};
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background-color 0.2s;
  
  &:hover {
    background-color: ${props => props.$isActive ? '#3a7bd5' : '#e5e5e5'};
  }
`;

// Add new styled components for filters
const FiltersContainer = styled.div`
  background-color: #f9f9f9;
  border-radius: 8px;
  padding: 15px;
  margin-bottom: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 15px;
  align-items: flex-end;
  position: relative;
`;

const FilterInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
`;

const FilterLabel = styled.label`
  font-size: 14px;
  font-weight: 500;
  color: #555;
`;

const FilterInput = styled.input`
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

const FilterButtonGroup = styled.div`
  display: flex;
  gap: 10px;
  align-items: flex-end;
`;

const ClearFilterButton = styled.button`
  background-color: transparent;
  color: #666;
  border: 1px solid #ddd;
  border-radius: 4px;
  padding: 8px 12px;
  font-size: 14px;
  cursor: pointer;
  
  &:hover {
    background-color: #f5f5f5;
  }
`;

const FilterStats = styled.div`
  position: absolute;
  right: 15px;
  top: 15px;
  font-size: 12px;
  color: #666;
`;

const ActiveSearchesContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
`;

const SectionTitle = styled.h2`
  font-size: 18px;
  margin-bottom: 15px;
  color: #333;
`;

const SearchFormContainer = styled.div`
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
  padding: 20px;
  margin-bottom: 20px;
`;

const SearchForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 15px;
`;

const SearchFormRow = styled.div`
  display: flex;
  gap: 15px;
  
  @media (max-width: 600px) {
    flex-direction: column;
  }
`;

const SearchFormGroup = styled.div`
  flex: 1;
`;

const SearchInput = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

const SearchSelect = styled.select`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

const SearchButtonContainer = styled.div`
  display: flex;
  justify-content: flex-end;
`;

const SearchButton = styled.button`
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

const SearchErrorMessage = styled.div`
  color: #c62828;
  font-size: 12px;
  margin-top: 5px;
`;

// Add the Input styled component definition
const Input = styled.input`
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
  
  &:focus {
    outline: none;
    border-color: #4a90e2;
  }
`;

// Fix any isActive props by using $isActive instead
const NavLink = styled(Link)`
  padding: 10px 15px;
  color: ${props => props.$isActive ? '#4a90e2' : '#666'};
  text-decoration: none;
  font-weight: ${props => props.$isActive ? '600' : '400'};
  border-bottom: 2px solid ${props => props.$isActive ? '#4a90e2' : 'transparent'};
  transition: all 0.2s;
  
  &:hover {
    color: #4a90e2;
  }
`;

// Update isActive to $isActive in StatusFilter styled component definition
const StatusFilter = styled.button`
  padding: 8px 12px;
  border-radius: 20px;
  border: none;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  background-color: ${props => props.$isActive ? '#4a90e2' : '#f5f5f5'};
  color: ${props => props.$isActive ? 'white' : '#333'};
  
  &:hover {
    background-color: ${props => props.$isActive ? '#3a7bd5' : '#e5e5e5'};
  }
`;

// Add Spinner styled component
const Spinner = styled.div`
  width: 16px;
  height: 16px;
  border: 2px solid #f3f3f3;
  border-top: 2px solid #4a90e2;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-right: 8px;

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
`;

export default JobList; 
import React, { useState, useEffect, useContext } from 'react';
import styled from 'styled-components';
import { AuthContext } from '../../context/AuthContext';

const Settings = () => {
  const { user, updateSettings, error: authError } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    phone_number: '',
    messaging_provider: 'twilio',
    twilio_account_sid: '',
    twilio_auth_token: '',
    httpssms_api_key: ''
  });
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      setFormData({
        phone_number: user.phone_number || '',
        messaging_provider: user.messaging_provider || 'twilio',
        twilio_account_sid: user.twilio_account_sid || '',
        twilio_auth_token: user.twilio_auth_token || '',
        httpssms_api_key: user.httpssms_api_key || ''
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    // Basic validation
    if (!formData.phone_number) {
      setFormError('Phone number is required');
      return;
    }

    setIsSubmitting(true);
    const result = await updateSettings(formData);
    setIsSubmitting(false);

    if (result.success) {
      setFormSuccess('Settings updated successfully');
    } else {
      setFormError(result.error || 'Failed to update settings');
    }
  };

  return (
    <SettingsContainer>
      <SettingsCard>
        <CardTitle>Account Settings</CardTitle>
        {(formError || authError) && <ErrorMessage>{formError || authError}</ErrorMessage>}
        {formSuccess && <SuccessMessage>{formSuccess}</SuccessMessage>}
        <SettingsForm onSubmit={handleSubmit}>
          <FormGroup>
            <label htmlFor="messaging_provider">Messaging Provider</label>
            <select
              id="messaging_provider"
              name="messaging_provider"
              value={formData.messaging_provider}
              onChange={handleChange}
            >
              <option value="twilio">Twilio (SMS + receive)</option>
              <option value="httpssms">HTTPS SMS (send only)</option>
            </select>
          </FormGroup>
          {formData.messaging_provider === 'twilio' && (
            <>
              <FormGroup>
                <label htmlFor="twilio_account_sid">Twilio Account SID</label>
                <Input
                  type="text"
                  id="twilio_account_sid"
                  name="twilio_account_sid"
                  value={formData.twilio_account_sid}
                  onChange={handleChange}
                  placeholder="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                />
              </FormGroup>
              <FormGroup>
                <label htmlFor="twilio_auth_token">Twilio Auth Token</label>
                <Input
                  type="text"
                  id="twilio_auth_token"
                  name="twilio_auth_token"
                  value={formData.twilio_auth_token}
                  onChange={handleChange}
                  placeholder="your_auth_token"
                />
              </FormGroup>
            </>
          )}
          {formData.messaging_provider === 'httpssms' && (
            <>
              <FormGroup>
                <label htmlFor="httpssms_api_key">HTTPS SMS API Key</label>
                <Input
                  type="text"
                  id="httpssms_api_key"
                  name="httpssms_api_key"
                  value={formData.httpssms_api_key}
                  onChange={handleChange}
                  placeholder="Your HTTPS SMS API Key"
                />
              </FormGroup>
              <Notice>
                <strong>Note:</strong> With HTTPS SMS, you must install our Android app and create an account to receive and manage messages. The web app will only send the initial promotional message; use the mobile app to view replies or manage conversations.
              </Notice>
            </>
          )}
          <FormGroup>
            <label htmlFor="phone_number">Your Phone Number</label>
            <Input
              type="tel"
              id="phone_number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="+123456789"
              required
            />
          </FormGroup>

          <SubmitButton type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Settings'}
          </SubmitButton>
        </SettingsForm>
      </SettingsCard>
    </SettingsContainer>
  );
};

// Styled Components
const SettingsContainer = styled.div`
  max-width: 600px;
  margin: 40px auto;
  padding: 20px;
`;

const SettingsCard = styled.div`
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 24px;
`;

const CardTitle = styled.h2`
  margin-top: 0;
  margin-bottom: 20px;
  color: #333;
`;

const SettingsForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;

  label {
    margin-bottom: 8px;
    font-weight: 500;
    color: #555;
  }
`;

const Input = styled.input`
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #4a90e2;
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

  &:disabled {
    background-color: #cccccc;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  background-color: #ffebee;
  color: #c62828;
  padding: 10px;
  border-radius: 4px;
`
;

const SuccessMessage = styled.div`
  background-color: #e8f5e9;
  color: #2e7d32;
  padding: 10px;
  border-radius: 4px;
`;

const Notice = styled.div`
  background-color: #fff4e5;
  color: #665;
  padding: 10px;
  border-left: 4px solid #ffa000;
  font-size: 13px;
  border-radius: 4px;
  margin-bottom: 10px;
`;

export default Settings; 
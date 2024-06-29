import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import { v4 as uuidv4 } from 'uuid';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [calendlyUrl, setCalendlyUrl] = useState(''); // State for Calendly URL
  const messagesEndRef = useRef(null);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const storedSessionId = sessionStorage.getItem('sessionId');
    if (storedSessionId) {
      setSessionId(storedSessionId);
    } else {
      const newSessionId = uuidv4();
      sessionStorage.setItem('sessionId', newSessionId);
      setSessionId(newSessionId);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleClearChat = () => {
    setMessages([]);
    sessionStorage.removeItem('sessionId');
    const newSessionId = uuidv4();
    sessionStorage.setItem('sessionId', newSessionId);
    setSessionId(newSessionId);
    setCalendlyUrl(''); // Clear Calendly URL
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newMessage = {
      role: 'user',
      content: userMessage
    };

    try {
      const response = await axios.post('https://chatappdemobackend.azurewebsites.net/chat', newMessage, {
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId
        },
        withCredentials: true
      });

      // Check if response contains Calendly URL
      if (response.data.calendly_url) {
        setCalendlyUrl(response.data.calendly_url);
      } else {
        const filteredMessages = response.data.messages.filter(msg => msg.role !== 'system');
        setMessages(filteredMessages);
      }
      
      setUserMessage('');
    } catch (error) {
      console.error('Network or Server Error:', error);
      if (error.response) {
        console.error('Error Response Data:', error.response.data);
        console.error('Error Response Status:', error.response.status);
        console.error('Error Response Headers:', error.response.headers);
      } else if (error.request) {
        console.error('No response received:', error.request);
      } else {
        console.error('Error Message:', error.message);
      }
    }
  };

  const getMessageContent = (message) => {
    if (typeof message.content === 'object') {
      return { __html: message.content.content };
    }
    return { __html: message.content };
  };

  return (
    <div className="App">
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <p dangerouslySetInnerHTML={getMessageContent(message)} />
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        {calendlyUrl && (
          <div className="calendly-container">
            <iframe
              src={calendlyUrl}
              style={{ width: '100%', height: '600px', border: 'none' }}
              frameBorder="0"
              scrolling="yes"
              title="Calendly Scheduling"
            ></iframe>
          </div>
        )}
        {!calendlyUrl && (
          <form onSubmit={handleSubmit} className="message-input">
            <input
              type="text"
              placeholder="Kako vam mogu pomoći?"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
            />
            <Button type="submit" disabled={!userMessage.trim()}>
              <SendIcon />
            </Button>
            {messages.length > 0 && (
              <div className="clear-chat">
                <Button type="button" onClick={handleClearChat} color="secondary" variant="contained">
                  <DeleteIcon /> Obriši
                </Button>
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
};

export default App;

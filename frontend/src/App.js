import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import Box from '@mui/material/Box';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileSharpIcon from '@mui/icons-material/AttachFileSharp';
import SaveAltSharpIcon from '@mui/icons-material/SaveAltSharp';
import { v4 as uuidv4 } from 'uuid';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
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

      const filteredMessages = response.data.messages.filter(msg => msg.role !== 'system');
      setMessages(filteredMessages);
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

  const actions = [
    { icon: <DeleteIcon />, name: 'Delete', onClick: handleClearChat },
    { icon: <AttachFileSharpIcon />, name: 'Attachment' },
    { icon: <SaveAltSharpIcon />, name: 'Save' },
  ];

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
        <form onSubmit={handleSubmit} className="message-input">
          <Box className="input-container">
            <SpeedDial
              ariaLabel="SpeedDial basic"
              className="speed-dial"
              icon={<SpeedDialIcon />}
            >
              {actions.map((action) => (
                <SpeedDialAction
                  key={action.name}
                  icon={action.icon}
                  tooltipTitle={action.name}
                  onClick={action.onClick}
                  className="speed-dial-action"
                />
              ))}
            </SpeedDial>
            <input
              type="text"
              placeholder="Kako vam mogu pomoći?"
              value={userMessage}
              onChange={(e) => setUserMessage(e.target.value)}
              className="input-field"
            />
            <Button type="submit" disabled={!userMessage.trim()} className="send-button">
              <SendIcon />
            </Button>
          </Box>
        </form>
      </div>
    </div>
  );
};

export default App;
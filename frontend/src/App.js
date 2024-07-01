import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileSharpIcon from '@mui/icons-material/AttachFileSharp';
import SaveAltSharpIcon from '@mui/icons-material/SaveAltSharp';
import Tooltip from '@mui/material/Tooltip';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import { v4 as uuidv4 } from 'uuid';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
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

  const handleVoiceClick = () => {
    setIsRecording(!isRecording);
  };

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

    setMessages([...messages, newMessage]);
    setUserMessage('');

    try {
      const response = await axios.post('https://chatappdemobackend.azurewebsites.net/chat', newMessage, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId
        },
        withCredentials: true
      });

      const data = response.data;

      // Extract the URL from the assistant's response if it contains a URL
      const urlRegex = /(https?:\/\/[^\s]+)/g;
      const urlMatch = data.content.match(urlRegex);

      if (urlMatch) {
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: 'assistant', content: urlMatch[0], type: 'calendly' },
        ]);
      } else {
        const assistantMessage = { role: 'assistant', content: data.content };
        setMessages((prevMessages) => [...prevMessages, assistantMessage]);
      }
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
    { icon: <DeleteIcon />, name: 'Obriši', onClick: handleClearChat },
    { icon: <AttachFileSharpIcon />, name: 'Dodaj prilog' },
    { icon: <SaveAltSharpIcon />, name: 'Sačuvaj' },
    { icon: <TipsAndUpdatesIcon />, name: 'Predlozi pitanja/odgovora' },
    { icon: <VolumeUpIcon />, name: 'Slušaj odgovor asistenta' }

  ];

  return (
    <div className="App">
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              {message.type === 'calendly' ? (
              <iframe
                src={message.content}
                width="90%"
                height="400px"
                style={{ border: 'none', scrolling: 'yes' }}
                title="Calendly Scheduling"
              ></iframe>
            ) : (
              <p dangerouslySetInnerHTML={getMessageContent(message)} />
            )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-row">
          <form onSubmit={handleSubmit} className="message-input">
            <div className="input-container">
              <input
                type="text"
                placeholder="Kako vam mogu pomoći?"
                value={userMessage}
                onChange={(e) => setUserMessage(e.target.value)}
              />
              {userMessage.trim() ? (
                <Button type="submit" className="send-button">
                  <SendIcon />
                </Button>
              ) : (
                <Tooltip title="Kliknite da započnete snimanje">
                  <Button
                    className={`send-button ${isRecording ? 'recording' : ''}`}
                    onClick={handleVoiceClick}
                  >
                    <KeyboardVoiceIcon />
                  </Button>
                </Tooltip>
              )}
            </div>
          </form>
          <SpeedDial
            ariaLabel="SpeedDial basic example"
            className="speed-dial"
            icon={<SpeedDialIcon />}
          >
            {actions.map((action) => (
              <SpeedDialAction
                key={action.name}
                icon={action.icon}
                tooltipTitle={action.name}
                onClick={action.onClick}
              />
            ))}
          </SpeedDial>
        </div>
      </div>
    </div>
  );
}

export default App;
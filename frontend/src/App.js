import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import Button from '@mui/material/Button';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileSharpIcon from '@mui/icons-material/AttachFileSharp';
import SaveAltSharpIcon from '@mui/icons-material/SaveAltSharp';
import Switch from '@mui/material/Switch';
import Tooltip from '@mui/material/Tooltip';
import HelpIcon from '@mui/icons-material/Help';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { alpha, styled } from '@mui/material/styles';
import { pink } from '@mui/material/colors';
import { v4 as uuidv4 } from 'uuid';

const PinkSwitch = styled(Switch)(({ theme }) => ({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: pink[600],
    '&:hover': {
      backgroundColor: alpha(pink[600], theme.palette.action.hoverOpacity),
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: pink[600],
  },
}));

const App = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [sessionId, setSessionId] = useState('');
  const [suggestionsEnabled, setSuggestionsEnabled] = useState(false);
  const [listenEnabled, setListenEnabled] = useState(false);

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
    { icon: <DeleteIcon />, name: 'Obriši', onClick:{handleClearChat}},
    { icon: <AttachFileSharpIcon />, name: 'Dodaj prilog' },
    { icon: <SaveAltSharpIcon />, name: 'Sačuvaj' },
  ];

  return (
    <div className="App">
      <div className="chat-container">
        <div className="switches-container">
        <div className="switch-label">
            <PinkSwitch
              color="warning"
              checked={suggestionsEnabled}
              onChange={() => setSuggestionsEnabled(!suggestionsEnabled)}
            />
            <TipsAndUpdatesIcon className="switch-icon" fontSize="small"/>
            <span>Predlozi pitanja/odgovora</span>
            <Tooltip title="Predlozi pitanja/odgovora za asistenta">
              <HelpIcon className="help-icon" fontSize="small"/>
            </Tooltip>
          </div>
          <div className="switch-label">
            <PinkSwitch
              color="warning"
              checked={listenEnabled}
              onChange={() => setListenEnabled(!listenEnabled)}
            />
            <VolumeUpIcon className="switch-icon" fontSize="small"/>
            <span>Slušaj odgovor</span>
            <Tooltip title="Slušaj odgovor asistenta">
              <HelpIcon className="help-icon" fontSize="small"/>
            </Tooltip>
          </div>
        </div>
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className={`message ${message.role}`}>
              <p dangerouslySetInnerHTML={getMessageContent(message)} />
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
              <Button type="submit" disabled={!userMessage.trim()} className="send-button">
                <SendIcon />
              </Button>
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
              />
            ))}
          </SpeedDial>
        </div>
      </div>
    </div>
  );
}

export default App;
import React, { useState, useEffect, useRef } from 'react';
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
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import { alpha, styled } from '@mui/material/styles';
import { pink } from '@mui/material/colors';
import { v4 as uuidv4 } from 'uuid';

const PinkSwitch = styled(Switch)(({ theme }) => ({
  '& .MuiSwitch-switchBase.Mui-checked': {
    color: pink[500],
    '&:hover': {
      backgroundColor: alpha(pink[500], theme.palette.action.hoverOpacity),
    },
  },
  '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
    backgroundColor: pink[500],
  },
}));

const App = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
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
    handleStreamedResponse();
  };

  async function* fetchStream(url, options = {}) {
    const response = await fetch(url, options);
    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split("\n");
      const parsedLines = lines
        .map((line) => line.replace(/^data: /, "").trim())
        .filter((line) => line !== "" && line !== "[DONE]") 
        .map((line) => JSON.parse(line));

      for (const parsedLine of parsedLines) {
        const { choices } = parsedLine;
        const { delta } = choices[0];
        const { content } = delta;
  
        if (content) {
          yield content;
        }
      }
    }
  }

  async function handleStreamedResponse() {
    const newMessage = {
      role: 'user',
      content: userMessage
    };

    setMessages(prev => [...prev, newMessage]);
    setUserMessage('');

    try {
      const stream = await fetchStream('https://chatappdemobackend.azurewebsites.net/chat', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId
        },
        body: JSON.stringify(newMessage),
        credentials: 'include'
      });

      for await (const chunk of stream) {
        setMessages(prev => {
          const lastMessage = prev[prev.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content += chunk;
            return [...prev.slice(0, -1), lastMessage];
          } else {
            return [...prev, { role: 'assistant', content: chunk }];
          }
        });
      }
    } catch (error) {
      console.error('Stream error:', error);
    }
  }

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
            <Tooltip title="Slušajte odgovor asistenta">
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
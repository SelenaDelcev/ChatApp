import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import axios from 'axios';
import SpeedDial from '@mui/material/SpeedDial';
import SpeedDialIcon from '@mui/material/SpeedDialIcon';
import SpeedDialAction from '@mui/material/SpeedDialAction';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import AttachFileSharpIcon from '@mui/icons-material/AttachFileSharp';
import SaveAltSharpIcon from '@mui/icons-material/SaveAltSharp';
import Tooltip from '@mui/material/Tooltip';
import TipsAndUpdatesIcon from '@mui/icons-material/TipsAndUpdates';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import KeyboardVoiceIcon from '@mui/icons-material/KeyboardVoice';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import { v4 as uuidv4 } from 'uuid';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef(null);
  const [sessionId, setSessionId] = useState('');
  const [files, setFiles] = useState([]);
  const [tooltipText, setTooltipText] = useState({});

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
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition is not supported in this browser');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'sr-RS';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsRecording(true);
      console.log('Speech recognition started');
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      console.log('Transcript:', transcript);
      setUserMessage(transcript);
      setIsRecording(false);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      setIsRecording(false);
    };

    recognition.start();
  };

  const getEventSource = () => {
    const eventSource = new EventSource(`https://chatappdemobackend.azurewebsites.net/chat/stream?session_id=${sessionId}`, {
      withCredentials: true
    });

    eventSource.onopen = function() {
      console.log("EventSource connection opened.");
      setMessages(prevMessages => [...prevMessages, { role: 'assistant', content: '' }]);
    };

    eventSource.onmessage = function(event) {
      const data = JSON.parse(event.data);
      const content = data.content;

      updateLastMessage({ role: 'assistant', content: content });

      if (!content.endsWith('▌')) {
        eventSource.close();
        updateLastMessage({ role: 'assistant', content: content.replace('▌', '') });
      }
    };

    eventSource.onerror = function(event) {
      console.error("EventSource failed.", event);
      eventSource.close();
    };
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newMessage = {
      role: 'user',
      content: userMessage
    };

    setMessages([...messages, newMessage]);
    setUserMessage('');

    if (files.length > 0) {
      await handleFileSubmit(newMessage);
    } else {
      try {
        const response = await axios.post('https://chatappdemobackend.azurewebsites.net/chat', newMessage, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Session-ID': sessionId
          },
          withCredentials: true,
          responseType: 'text'
        });

        const data = JSON.parse(response.data);

        if (data && data.calendly_url) {
          setMessages((prevMessages) => [
            ...prevMessages,
            { role: 'assistant', content: data.calendly_url, type: 'calendly' },
          ]);
        } else {
          getEventSource();
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
    }
  };

  const updateLastMessage = (newMessage) => {
    setMessages(prevMessages => {
      const lastIndex = prevMessages.length - 1;

      if (prevMessages[lastIndex] && prevMessages[lastIndex].role === 'assistant') {
        const updatedMessages = [...prevMessages];
        updatedMessages[lastIndex] = newMessage;
        return updatedMessages;
      }
      return [...prevMessages, newMessage];
    });
  };

  const sanitizeText = (text) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = text;
    return tempDiv.textContent || tempDiv.innerText || '';
  };

  const handleSaveChat = () => {
    const chatContent = messages.map(msg => `${msg.role}: ${sanitizeText(msg.content)}`).join('\n');
    const blob = new Blob([chatContent], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'chat.txt';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleFileChange = (e) => {
    setFiles([...files, ...Array.from(e.target.files)]);
  };

  const handleFileDelete = () => {
    setFiles(prevFiles => prevFiles.filter((_, i) => i !== index));
  };

  const handleFileSubmit = async (newMessage) => {
    if (!files) return;

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    formData.append('message', newMessage.content);

    try {
      const response = await axios.post('https://chatappdemobackend.azurewebsites.net/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Session-ID': sessionId
        }
      });

      const data = response.data;
      if (data && data.detail) {
        handleErrorMessage(data.detail);
      } else {
        getEventSource();
      }
    } catch (error) {
      console.error('File upload error:', error);
    }
  };

  const handleErrorMessage = (errorMessage) => {
    setMessages(prevMessages => [
      ...prevMessages,
      { role: 'assistant', type: 'error', content: errorMessage }
    ]);
  };

  const handleCopyToClipboard = (messageContent, index) => {
    const sanitizedText = sanitizeText(messageContent);
    const textArea = document.createElement('textarea');
    textArea.value = sanitizedText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
    setTooltipText((prev) => ({
      ...prev,
      [index]: 'Kopirano!'
    }));
    setTimeout(() => {
      setTooltipText((prev) => ({
        ...prev,
        [index]: 'Klikni da kopiraš tekst'
      }));
    }, 3000);
  };

  const getMessageContent = (message) => {
    if (typeof message.content === 'object') {
      return { __html: message.content.content };
    }
    return { __html: message.content };
  };

  const actions = [
    { icon: <DeleteIcon />, name: 'Obriši', onClick: handleClearChat },
    {
      icon: (
        <div>
        <AttachFileSharpIcon style={{ color: files.length > 0 ? 'red' : 'inherit' }} />
        {files.length > 0 && files.map((file, index) => (
          <div key={index} className="file-item">
            <Tooltip title={file.name} placement="left" arrow>
              <span>{file.name}</span>
            </Tooltip>
            <CancelOutlinedIcon
              className="cancel-icon"
              onClick={(e) => {
                e.stopPropagation();
                handleFileDelete(index);
              }}
            />
          </div>
        ))}
      </div>
    ),
    name: files.length > 0 ? `${files.length} files` : 'Dodaj prilog',
    onClick: () => document.getElementById('fileInput').click()
  },
    { icon: <SaveAltSharpIcon />, name: 'Sačuvaj', onClick: handleSaveChat },
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
                  title="Calendly Scheduling"
                ></iframe>
              ) : message.type === 'error' ? (
                <Alert variant="outlined" severity="error" style={{ color: 'white' }}>{message.content}</Alert>
              ) : (
                <Tooltip
                  title={tooltipText[index] || 'Klikni da kopiraš tekst'}
                  placement="top"
                  arrow
                >
                  <div onClick={() => handleCopyToClipboard(message.content, index)}>
                    <p dangerouslySetInnerHTML={getMessageContent(message)} />
                  </div>
                </Tooltip>
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
          <input
            id="fileInput"
            type="file"
            multiple
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
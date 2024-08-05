import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import {
  SpeedDial,
  SpeedDialIcon,
  SpeedDialAction,
  Button,
  Alert,
  Tooltip,
  Avatar
} from '@mui/material';
import {
  Send as SendIcon,
  Delete as DeleteIcon,
  AttachFileSharp as AttachFileSharpIcon,
  SaveAltSharp as SaveAltSharpIcon,
  TipsAndUpdates as TipsAndUpdatesIcon,
  VolumeUp as VolumeUpIcon,
  KeyboardVoice as KeyboardVoiceIcon,
  CancelOutlined as CancelOutlinedIcon
} from '@mui/icons-material';

const App = () => {
  const [messages, setMessages] = useState([]);
  const [userMessage, setUserMessage] = useState('');
  const messagesEndRef = useRef(null);
  const [sessionId, setSessionId] = useState('');
  const [files, setFiles] = useState([]);
  const [tooltipText, setTooltipText] = useState({});
  const [suggestQuestions, setSuggestQuestions] = useState(false);
  const [userSuggestQuestions, setUserSuggestQuestions] = useState([]);
  const [isAssistantResponding, setIsAssistantResponding] = useState(false);
  const mediaRecorderRef = useRef(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioResponse, setAudioResponse] = useState(false);
  const audioRef = useRef(null);
  const [audioBase64, setAudioBase64] = useState(null);
  const [language, setLanguage] = useState('sr');
  const [showTypingIndicator, setShowTypingIndicator] = useState(false);

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

  useEffect(() => {
    const handleMessage = (event) => {
      if (event.origin !== 'https://test.georgemposi.com') return;

      if (event.data.type === 'main-url') {
        const path = event.data.url;
        const isEnglish = path.includes('/en/') || path.endsWith('/en');
        setLanguage(isEnglish ? 'en' : 'sr');
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleAudioUpload = async (blob) => {
    const formData = new FormData();
    formData.append('blob', blob);
    formData.append('session_id', sessionId);

    try {
      const response = await axios.post('https://chatappdemobackend.azurewebsites.net/transcribe', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Session-ID': sessionId
        }
      });
      const { transcript } = response.data;
      setUserMessage(transcript);
      setIsRecording(false);
    } catch (error) {
      console.log(error)
      setIsRecording(false);
    }
  };

  const handleVoiceClick = () => {
    if (isRecording) {
      mediaRecorderRef.current.stop();
    } else {
      navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        let silenceTimeout;
        let chunks = [];

        const resetSilenceTimeout = () => {
          clearTimeout(silenceTimeout);
          silenceTimeout = setTimeout(() => {
            mediaRecorderRef.current.stop();
          }, 5000);
        };

        mediaRecorderRef.current.ondataavailable = (event) => {
          chunks.push(event.data);
        };

        mediaRecorderRef.current.onstart = () => {
          resetSilenceTimeout();
        };

        mediaRecorderRef.current.onstop = () => {
          const blob = new Blob(chunks, { type: 'audio/webm' });
          handleAudioUpload(blob);
          chunks = [];
          clearTimeout(silenceTimeout);
        };

        mediaRecorderRef.current.start();
        setIsRecording(true);

        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        source.connect(analyser);
        analyser.fftSize = 2048;
        const dataArray = new Uint8Array(analyser.fftSize);

        const detectSilence = () => {
          analyser.getByteTimeDomainData(dataArray);
          const isSilent = dataArray.every(value => value === 128);
          if (!isSilent) {
            resetSilenceTimeout();
          }
          if (isRecording) {
            requestAnimationFrame(detectSilence);
          }
        };

        detectSilence();
      }).catch(() => {
        setIsRecording(false);
      });
    }
  };

  const handleAudioResponse = (audioBase64) => {
    if (audioResponse) {
      setAudioBase64(audioBase64);
      const audio = new Audio(`data:audio/webm;base64,${audioBase64}`);
      audioRef.current = audio;
    }
  };

  const fetchSuggestedQuestions = async () => {
    try {
      const response = await axios.get('https://chatappdemobackend.azurewebsites.net/suggest-questions');
      const data = response.data;
      console.log("Data:", data)
      if (data.suggested_questions) {
        setUserSuggestQuestions(data.suggested_questions.filter(q => q.trim() !== ''));
      } else {
        setUserSuggestQuestions([]);
      }
    } catch (error) {
      console.error('Error fetching suggested questions:', error);
    }
  };

  const getEventSource = () => {
    setIsAssistantResponding(true);
    const eventSource = new EventSource(`https://chatappdemobackend.azurewebsites.net/chat/stream?session_id=${sessionId}`, {
      withCredentials: true
    });

    eventSource.onopen = () => {
      console.log("EventSource connection opened.");
    };

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const content = data.content;

      if (data.audio) {
        handleAudioResponse(data.audio);
      }

      updateLastMessage({ role: 'assistant', content: content });

      if (!content.endsWith('▌')) {
        eventSource.close();
        updateLastMessage({ role: 'assistant', content: content.replace('▌', '') });
        setIsAssistantResponding(false);
        if(suggestQuestions) 
          fetchSuggestedQuestions();
      }
    };

    eventSource.onerror = (event) => {
      console.error("EventSource failed.", event);
      eventSource.close();
      setIsAssistantResponding(false);
    };
  };

  const handleClearChat = () => {
    setMessages([]);
    sessionStorage.removeItem('sessionId');
    const newSessionId = uuidv4();
    sessionStorage.setItem('sessionId', newSessionId);
    setSessionId(newSessionId);
    setFiles([]);
    setUserSuggestQuestions([]);
    setAudioBase64(null);
  };

  const handleSuggestQuestions = () => {
    setSuggestQuestions(!suggestQuestions);
  };

  const handleAudioResponseClick = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (audioResponse === false) {
      setAudioBase64(null);
    }
    setAudioResponse(!audioResponse);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const newMessage = {
      role: 'user',
      content: userMessage
    };
    
    setUserMessage('');

    setMessages(prevMessages => [...prevMessages, newMessage]);
    setShowTypingIndicator(true);

    if (files.length > 0) {
      await handleFileSubmit(newMessage);
    } else {
      try { 
        const response = await axios.post('https://chatappdemobackend.azurewebsites.net/chat', {
          message: newMessage,
          suggest_questions: suggestQuestions,
          play_audio_response: audioResponse,
          language: language
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Session-ID': sessionId
          },
          withCredentials: true,
        });

        const data = response.data;

        if (data && data.calendly_url) {
          setMessages(prevMessages => [
            ...prevMessages,
            { role: 'assistant', content: data.calendly_url, type: 'calendly' },
          ]);
          setShowTypingIndicator(false);
        } else {
          getEventSource();
        }

        if (data.suggested_questions) {
          setUserSuggestQuestions(data.suggested_questions.filter(q => q.trim() !== ''));
        } else {
          setUserSuggestQuestions([]);
        }
      } catch (error) {
        console.error('Network or Server Error:', error);
      }
    }
  };

  const handleSuggestedQuestionClick = async (question) => {
    const newMessage = {
      role: 'user',
      content: question
    };
  
    setMessages(prevMessages => [...prevMessages, newMessage]);
    setUserSuggestQuestions([]);
  
    if (files.length > 0) {
      await handleFileSubmit(newMessage);
    } else {
      try { 
        const response = await axios.post('https://chatappdemobackend.azurewebsites.net/chat', {
          message: newMessage,
          suggest_questions: suggestQuestions,
          play_audio_response: audioResponse,
          language: language
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Session-ID': sessionId
          },
          withCredentials: true,
        });
  
        const data = response.data;
  
        if (data && data.calendly_url) {
          setMessages(prevMessages => [
            ...prevMessages,
            { role: 'assistant', content: data.calendly_url, type: 'calendly' },
          ]);
        } else {
          getEventSource();
        }
  
        if (data.suggested_questions) {
          setUserSuggestQuestions(data.suggested_questions.filter(q => q.trim() !== ''));
        } else {
          setUserSuggestQuestions([]);
        }
      } catch (error) {
        console.error('Network or Server Error:', error);
      }
    }
  };

  const updateLastMessage = (newMessage) => {
    setShowTypingIndicator(false);
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

  const handleFileDelete = (index) => {
    setFiles(prevFiles => {
      const updatedFiles = prevFiles.filter((_, i) => i !== index);
      return updatedFiles;
    });
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
    const contentToSanitize = typeof messageContent === 'object' && messageContent !== null ? messageContent.content : messageContent;
    const sanitizedText = sanitizeText(contentToSanitize);
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
        [index]: (language === 'en' ? 'Copy to clipboard' : 'Klikni da kopiraš tekst')
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
    { icon: <DeleteIcon />, name: (language === 'en' ? 'Delete' : 'Obriši'), onClick: handleClearChat },
    {
      icon: (
        <div style={{ position: 'relative' }}>
          <AttachFileSharpIcon style={{ color: files.length > 0 ? 'red' : 'inherit' }} />
          {files.length > 0 && (
            files.map((file, index) => (
              <div key={index} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <CancelOutlinedIcon
                  style={{
                    position: 'absolute',
                    top: -5,
                    right: -5,
                    cursor: 'pointer',
                    color: '#8695a3'
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleFileDelete(index);
                  }}
                />
              </div>
            ))
          )}
        </div>
      ),
      name: files.length > 0 ? files.map(file => file.name).join('\n') : (language === 'en' ? 'Attach files' : 'Dodaj priloge'),
      onClick: () => document.getElementById('fileInput').click()
    },
    { icon: <SaveAltSharpIcon />, name: (language === 'en' ? 'Save' : 'Sačuvaj'), onClick: handleSaveChat },
    { icon: <TipsAndUpdatesIcon style={{ color: suggestQuestions ? 'red' : 'inherit' }} />, name: suggestQuestions ? (language === 'en' ? 'Turn off question suggestions' : 'Isključi predloge pitanja') : (language === 'en' ? 'Turn on question suggestions' : 'Predlozi pitanja/odgovora'), onClick: handleSuggestQuestions },
    { icon: <VolumeUpIcon style={{ color: audioResponse ? 'red' : 'inherit' }} />, name: audioResponse ? (language === 'en' ? 'Turn off assistant audio response' : 'Isključi audio odgovor asistenta') : (language === 'en' ? 'Turn on assistant audio response' : 'Slušaj odgovor asistenta'), onClick: handleAudioResponseClick },
  ];

  return (
    <div className="App">
      <div className="chat-container">
        <div className="messages">
          {messages.map((message, index) => (
            <div key={index} className="message-container">
              {message.role === 'assistant' && (
                <div className="assistant-avatar">
                  <Avatar
                    alt="3Pi"
                    src="/avatar.jpg"
                    sx={{ width: 25, height: 25 }}
                  />
                </div>
              )}
              <div className={`message ${message.role}`}>
                {message.type === 'calendly' ? (
                  <iframe
                    src={message.content}
                    title="Calendly Scheduling"
                  ></iframe>
                ) : message.type === 'error' ? (
                  <Alert variant="outlined" severity="error" style={{ color: 'red' }}>{message.content}</Alert>
                ) : (
                  <Tooltip
                    title={tooltipText[index] || (language === 'en' ? 'Copy to clipboard' : 'Klikni da kopiraš tekst')}
                    placement="top"
                    arrow
                  >
                    <div>
                      <div onClick={() => handleCopyToClipboard(message.content, index)}>
                        <p dangerouslySetInnerHTML={getMessageContent(message)} />
                      </div>
                      {message.role === 'assistant' && audioResponse && audioBase64 && index === messages.length - 1 && !isAssistantResponding && (
                        <audio controls autoPlay>
                          <source src={`data:audio/webm;base64,${audioBase64}`} type="audio/webm" />
                          Your browser does not support the audio element.
                        </audio>
                      )}
                    </div>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
          {showTypingIndicator && (
          <div className="message-container">
            <div className="assistant-avatar">
              <Avatar
                alt="3Pi"
                src="/avatar.jpg"
                sx={{ width: 25, height: 25 }}
              />
            </div>
            <div className="typing-indicator">
              <span className="dot-1">.</span><span className="dot-2">.</span><span className="dot-3">.</span>
            </div>
          </div>
          )}
          {!isAssistantResponding && userSuggestQuestions.length > 0 && suggestQuestions && (
            <div className="suggested-questions">
              {userSuggestQuestions.map((question, index) => (
                <Button
                  key={index}
                  variant="outlined"
                  onClick={() => handleSuggestedQuestionClick(question)}
                  style={{ marginBottom: '10px', borderColor: '#ffff' }}
                >
                  {question}
                </Button>
              ))}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
        <div className="input-row-container">
          <div className="input-row">
            <form onSubmit={handleSubmit} className="message-input">
              <div className="input-container">
                <input
                  type="text"
                  placeholder={language === 'en' ? 'How can I help you?' : 'Kako vam mogu pomoći?'}
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                />
                {userMessage.trim() ? (
                  <Button type="submit" className="send-button">
                    <SendIcon />
                  </Button>
                ) : (
                  <Tooltip title={language === 'en' ? 'Click to start recording' : 'Kliknite da započnete snimanje'}>
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
    </div>
  );
};

export default App;

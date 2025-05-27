import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

function App() {
  const [conversations, setConversations] = useState([]);
  const [selectedConvId, setSelectedConvId] = useState(null);
  const [message, setMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const typingIntervalRef = useRef(null);
  const chatEndRef = useRef(null);
  const apiKey = process.env.REACT_APP_GROQ_API_KEY;
  const [renegenerating, setRegenerating] = useState(false);
  const [editingConvId, setEditingConvId] = useState(null);
  const [editingConvName, setEditingConvName] = useState("");
  const [regeneratingIndex, setRegeneratingIndex] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);
  const [theme, setTheme] = useState(
    () => localStorage.getItem("chat_theme") || "light"
  );
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    // Khởi tạo cuộc trò chuyện đầu tiên
    const initialConv = {
      id: Date.now(),
      name: "Cuộc trò chuyện mới",
      messages: [
        {
          role: "system",
          content:
            "Bạn là một chuyên gia tư vấn, hỗ trợ cho người dùng Việt Nam sử dụng web IOT smart house có chức năng monitor và điều khiển thiết bị. Bạn luôn trả lời bằng tiếng Việt một cách thân thiện và chuyên nghiệp. Bạn biết được các thông tin về hệ thống web đang quản lý 4 thiết bị, trong đó có đèn phòng khách, đèn nhà bếp, cửa, quạt. Hệ thống có quan sát nhiệt độ, độ ẫm mỗi 30 phút một lần và gửi lên web. Hãy luôn nói tiếng việt.",
        },
        {
          role: "assistant",
          content:
            "Chào bạn! Tôi là một chuyên gia tư vấn về công nghệ IOT smart house. Tôi giúp đỡ người dùng sử dụng các thiết bị IOT smart house để monitor và điều khiển các thiết bị trong nhà của mình. Nếu bạn có bất kỳ câu hỏi nào về các thiết bị IOT smart house hay cách sử dụng chúng, tôi sẵn sàng giúp đỡ bạn☺️",
        },
      ],
    };
    setConversations([initialConv]);
    setSelectedConvId(initialConv.id);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConvId, conversations, isTyping]);

  // Khởi tạo Web Speech API
  useEffect(() => {
    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window))
      return;
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = "vi-VN";
    recognitionRef.current.interimResults = false;
    recognitionRef.current.maxAlternatives = 1;
    recognitionRef.current.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setMessage((prev) => prev + (prev ? " " : "") + transcript);
      setIsListening(false);
    };
    recognitionRef.current.onend = () => setIsListening(false);
    recognitionRef.current.onerror = () => setIsListening(false);
  }, []);

  // Khi theme thay đổi, lưu vào localStorage
  useEffect(() => {
    localStorage.setItem("chat_theme", theme);
  }, [theme]);

  const currentConv = conversations.find((c) => c.id === selectedConvId);

  const sendMessage = async () => {
    if (!message.trim() || isTyping) return;

    const trimmedMessage = message.trim().toLowerCase();

    // === Kiểm tra yêu cầu mở nhạc và truy vấn video đầu tiên ===
    const match = trimmedMessage.match(/(?:mở|phát|nghe)\s+(?:bài\s+)?(.+)/i);
    if (match && match[1]) {
      const songName = match[1].trim();
      const query = encodeURIComponent(songName);
      const YOUTUBE_API_KEY = process.env.REACT_APP_YOUTUBE_API_KEY;

      try {
        const ytRes = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&key=${YOUTUBE_API_KEY}&maxResults=1`
        );
        const ytData = await ytRes.json();
        const videoId = ytData.items?.[0]?.id?.videoId;
        if (videoId) {
          window.open(`https://www.youtube.com/watch?v=${videoId}`, "_blank");
          setMessage("");
          return;
        }
      } catch (e) {
        alert("Không thể tìm video trên YouTube.");
      }
    }

    // === Xử lý gọi API chat như cũ ===
    const userMessage = { role: "user", content: message };
    updateMessages([...currentConv.messages, userMessage]);
    setMessage("");
    setIsTyping(true);

    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [...currentConv.messages, userMessage].filter(
              (msg) =>
                msg.role === "user" ||
                msg.role === "assistant" ||
                msg.role === "system"
            ),
            temperature: 0.7,
          }),
        }
      );
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status} - ${errorText}`);
      }
      const data = await response.json();
      const botReply =
        data.choices?.[0]?.message?.content.trim() ||
        "⚠️ Bot không trả lời được.";
      typeText(botReply, [...currentConv.messages, userMessage]);
    } catch (err) {
      typeText(`❌ Lỗi khi gọi API: ${err.message}`, [
        ...currentConv.messages,
        userMessage,
      ]);
    }
  };

  const typeText = (text, prevMsgs) => {
    updateMessages([...prevMsgs, { role: "assistant", content: text }]);
    setIsTyping(false);
  };

  const handlePause = () => {
    if (typingIntervalRef.current) {
      clearInterval(typingIntervalRef.current);
    }
    const msgs = [...currentConv.messages];
    updateMessages(msgs);
    setIsTyping(false);
  };

  function updateMessages(newMsgs) {
    setConversations((prev) =>
      prev.map((conv) =>
        conv.id === selectedConvId ? { ...conv, messages: newMsgs } : conv
      )
    );
  }

  function handleNewConversation() {
    const newConv = {
      id: Date.now(),
      name: `Cuộc trò chuyện ${conversations.length + 1}`,
      messages: [
        {
          role: "system",
          content:
            "Bạn là một chuyên gia tư vấn, hỗ trợ cho người dùng Việt Nam sử dụng web IOT smart house có chức năng monitor và điều khiển thiết bị. Bạn luôn trả lời bằng tiếng Việt một cách thân thiện và chuyên nghiệp. Bạn biết được các thông tin về hệ thống web đang quản lý 4 thiết bị, trong đó có đèn phòng khách, đèn nhà bếp, cửa, quạt. Hệ thống có quan sát nhiệt độ, độ ẫm mỗi 30 phút một lần và gửi lên web. Hãy luôn nói tiếng việt.",
        },
        {
          role: "assistant",
          content:
            "Chào bạn! Tôi là một chuyên gia tư vấn về công nghệ IOT smart house. Tôi giúp đỡ người dùng sử dụng các thiết bị IOT smart house để monitor và điều khiển các thiết bị trong nhà của mình. Nếu bạn có bất kỳ câu hỏi nào về các thiết bị IOT smart house hay cách sử dụng chúng, tôi sẵn sàng giúp đỡ bạn☺️",
        },
      ],
    };
    setConversations([newConv, ...conversations]);
    setSelectedConvId(newConv.id);
  }

  function handleSelectConversation(id) {
    setSelectedConvId(id);
  }

  function handleDeleteConversation(id) {
    const filtered = conversations.filter((conv) => conv.id !== id);
    setConversations(
      filtered.length
        ? filtered
        : [{ id: Date.now(), name: "Cuộc trò chuyện mới", messages: [] }]
    );
    if (selectedConvId === id && filtered.length) {
      setSelectedConvId(filtered[0].id);
    } else if (!filtered.length) {
      setSelectedConvId(filtered[0].id);
    }
  }

  function handleDeleteAllConversations() {
    setConversations([
      { id: Date.now(), name: "Cuộc trò chuyện mới", messages: [] },
    ]);
    setSelectedConvId(Date.now());
  }

  function handleRenameConversation(id, name) {
    setConversations((prev) =>
      prev.map((conv) => (conv.id === id ? { ...conv, name } : conv))
    );
    setEditingConvId(null);
  }

  const handleMicClick = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // Hàm dừng đọc
  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  // Theme variables
  const themeVars =
    theme === "dark"
      ? {
          background: "#18181a",
          sidebar: "#23232a",
          main: "#23232a",
          text: "#fff",
          header: "#23232a",
          messageUser: "#007bff",
          messageBot: "#333",
          messageBotText: "#fff",
          inputBg: "#23232a",
          inputText: "#fff",
          border: "#333",
        }
      : {
          background: "#f7f7f8",
          sidebar: "#f0f0f0",
          main: "#fff",
          text: "#222",
          header: "#fff",
          messageUser: "#007bff",
          messageBot: "#ececec",
          messageBotText: "#222",
          inputBg: "#f7f7f8",
          inputText: "#222",
          border: "#ddd",
        };

  // Styles
  const styles = {
    layout: {
      display: "flex",
      height: "100vh",
      background: themeVars.background,
      fontFamily: "'Inter', sans-serif",
    },
    sidebar: {
      width: 270,
      background: themeVars.sidebar,
      display: "flex",
      flexDirection: "column",
      padding: "16px 0 0 0",
      borderRight: `1px solid ${themeVars.border}`,
      minWidth: 220,
      maxWidth: 320,
      color: themeVars.text,
    },
    sidebarHeader: {
      fontWeight: 700,
      fontSize: 22,
      padding: "0 24px 16px 24px",
      marginBottom: 8,
      color: themeVars.text,
    },
    newChatBtn: {
      margin: "0 24px 16px 24px",
      padding: "10px 0",
      borderRadius: 8,
      border: "none",
      background: "#007bff",
      color: "#fff",
      fontWeight: 600,
      fontSize: 15,
      cursor: "pointer",
      transition: "background 0.2s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    deleteAllBtn: {
      margin: "0 24px 12px 24px",
      padding: "8px 0",
      borderRadius: 8,
      border: "none",
      background: "#ff4f4f",
      color: "#fff",
      fontWeight: 600,
      fontSize: 15,
      cursor: "pointer",
      transition: "background 0.2s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
    },
    historyList: {
      flex: 1,
      overflowY: "auto",
      marginBottom: 16,
    },
    historyItem: {
      padding: "10px 24px",
      borderRadius: 8,
      cursor: "pointer",
      margin: "0 8px 4px 8px",
      transition: "background 0.2s, font-weight 0.2s",
    },
    menuSection: {
      borderTop: `1px solid ${themeVars.border}`,
      padding: "16px 0 0 0",
    },
    menuItem: {
      padding: "10px 24px",
      color: themeVars.text,
      fontSize: 15,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      transition: "background 0.2s",
    },
    main: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      background: themeVars.main,
      color: themeVars.text,
    },
    header: {
      padding: "16px 0 0 0",
      textAlign: "center",
      color: themeVars.text,
      backgroundColor: themeVars.header,
      fontSize: "24px",
      fontWeight: "600",
      borderBottom: `1px solid ${themeVars.border}`,
    },
    chatContainer: {
      flex: 1,
      padding: "20px",
      overflowY: "auto",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      background: themeVars.main,
      color: themeVars.text,
    },
    messageRow: {
      display: "flex",
      marginBottom: "16px",
      width: "100%",
      maxWidth: "900px",
    },
    message: {
      maxWidth: "98%",
      padding: "12px 16px",
      borderRadius: "12px",
      fontSize: "15px",
      lineHeight: 1.6,
      wordBreak: "break-word",
      boxShadow: "0px 4px 12px rgba(0, 0, 0, 0.05)",
      transition: "all 0.3s ease",
    },
    inputContainer: {
      display: "flex",
      padding: "16px 20px",
      backgroundColor: themeVars.main,
      borderTop: `1px solid ${themeVars.border}`,
      boxShadow:
        theme === "dark"
          ? "0px -2px 10px rgba(0,0,0,0.5)"
          : "0px -2px 10px rgba(0, 0, 0, 0.03)",
      justifyContent: "center",
    },
    input: {
      flex: 1,
      maxWidth: "750px",
      padding: "12px 16px",
      borderRadius: "24px",
      border: `1px solid ${themeVars.border}`,
      outline: "none",
      fontSize: "15px",
      backgroundColor: themeVars.inputBg,
      color: themeVars.inputText,
      marginRight: "12px",
      transition: "all 0.3s",
    },
    button: {
      padding: "12px 20px",
      borderRadius: "24px",
      border: "none",
      color: "#fff",
      fontWeight: "600",
      cursor: "pointer",
      fontSize: "15px",
      transition: "transform 0.2s, background-color 0.2s",
    },
    dot: {
      width: "6px",
      height: "6px",
      backgroundColor: "#007bff",
      borderRadius: "50%",
      margin: "0 3px",
    },
    deleteBtn: {
      marginLeft: 8,
      background: "transparent",
      border: "none",
      color: "#ff4f4f",
      fontSize: 16,
      cursor: "pointer",
      padding: 0,
    },
    renameInput: {
      flex: 1,
      padding: "6px 8px",
      borderRadius: 6,
      border: "1px solid #bbb",
      fontSize: 15,
      marginRight: 8,
    },
    actionRow: {
      display: "flex",
      gap: 8,
      marginTop: 8,
    },
    copyBtn: {
      background: "#f0f0f0",
      border: "1px solid #ddd",
      borderRadius: 6,
      color: "#333",
      fontSize: 14,
      cursor: "pointer",
      padding: "4px 12px",
      fontWeight: 500,
      transition: "background 0.2s",
    },
    micBtn: {
      marginRight: 8,
      border: "none",
      borderRadius: "50%",
      width: 48,
      height: 48,
      fontSize: 24,
      cursor: "pointer",
      transition: "background 0.2s",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 0,
    },
  };

  // TypingIndicator component
  const TypingIndicator = () => (
    <div style={{ display: "flex", alignItems: "center" }}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <motion.span
          key={i}
          style={styles.dot}
          animate={{ opacity: [0, 1, 0] }}
          transition={{ repeat: Infinity, duration: 1.2, delay }}
        />
      ))}
    </div>
  );

  return (
    <>
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          style={{
            position: "fixed",
            left: 0,
            top: 18,
            zIndex: 2000,
            background: "#fff",
            color: "#007bff",
            border: "1.5px solid #007bff",
            borderRadius: "50%",
            width: 40,
            height: 40,
            fontSize: 22,
            cursor: "pointer",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
          }}
          title="Mở menu"
        >
          <i className="fas fa-bars"></i>
        </button>
      )}
      <div style={styles.layout}>
        {sidebarOpen && (
          <aside style={styles.sidebar}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 16px 0 24px",
                marginBottom: 8,
              }}
            >
              <div
                style={{ ...styles.sidebarHeader, padding: 0, marginBottom: 0 }}
              >
                <i className="fas fa-comments" style={{ marginRight: 8 }}></i>
                IOT Chat
              </div>
            </div>
            <button
              className="btn-blue-hover"
              style={styles.newChatBtn}
              onClick={handleNewConversation}
            >
              <i className="fas fa-plus" style={{ marginRight: 8 }}></i>
              Cuộc trò chuyện mới
            </button>
            <button
              className="btn-red-hover"
              style={styles.deleteAllBtn}
              onClick={handleDeleteAllConversations}
            >
              <i className="fas fa-trash" style={{ marginRight: 8 }}></i>
              Xoá tất cả lịch sử
            </button>
            <div style={styles.historyList}>
              {conversations.map((conv) => (
                <div
                  key={conv.id}
                  style={{
                    ...styles.historyItem,
                    background:
                      conv.id === selectedConvId ? "#ececec" : "transparent",
                    fontWeight: conv.id === selectedConvId ? 600 : 400,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                  onClick={() => handleSelectConversation(conv.id)}
                >
                  {editingConvId === conv.id ? (
                    <input
                      style={styles.renameInput}
                      value={editingConvName}
                      autoFocus
                      onChange={(e) => setEditingConvName(e.target.value)}
                      onBlur={() =>
                        handleRenameConversation(conv.id, editingConvName)
                      }
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        handleRenameConversation(conv.id, editingConvName)
                      }
                    />
                  ) : (
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingConvId(conv.id);
                        setEditingConvName(conv.name);
                      }}
                      title="Đổi tên cuộc trò chuyện (nhấp đúp)"
                    >
                      {conv.name}
                    </span>
                  )}
                  <button
                    className="btn-red-hover"
                    style={styles.deleteBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(conv.id);
                    }}
                    title="Xoá cuộc trò chuyện này"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              ))}
            </div>
          </aside>
        )}
        <div style={styles.main}>
          <motion.header
            style={{ ...styles.header, position: "relative" }}
            initial={{ y: -80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, type: "spring", stiffness: 70 }}
          >
            <i
              className="fas fa-comments"
              style={{
                fontSize: 60,
                color: theme === "dark" ? "#fff" : "#007bff",
                marginTop: 10,
              }}
            ></i>
            <span style={{ fontWeight: 700, fontSize: 32, marginLeft: 12 }}>
              IOT Support Chat
            </span>
            <div
              style={{
                position: "absolute",
                right: 32,
                top: 32,
                display: "flex",
                alignItems: "center",
                gap: 12,
                zIndex: 10,
              }}
            >
              <div
                style={{
                  padding: "8px 18px",
                  cursor: "pointer",
                  color: theme === "dark" ? "#ffb300" : "#222",
                  fontWeight: 500,
                  fontSize: 14,
                  borderRadius: 8,
                  transition: "background 0.18s",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                onMouseOver={(e) =>
                  (e.currentTarget.style.background = "#f0f0f0")
                }
                onMouseOut={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <i
                  className={`fas ${theme === "dark" ? "fa-sun" : "fa-moon"}`}
                  style={{ width: 18, height: 18, marginRight: 6 }}
                ></i>
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </div>
            </div>
          </motion.header>
          <div style={styles.chatContainer}>
            {currentConv ? (
              <AnimatePresence initial={false}>
                {currentConv.messages.slice(1).map((msg, index) => (
                  <motion.div
                    key={index}
                    style={{
                      ...styles.messageRow,
                      justifyContent:
                        msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <motion.div
                      style={{
                        ...styles.message,
                        background: msg.role === "user" ? "#007bff" : "#ececec",
                        color: msg.role === "user" ? "#fff" : "#222",
                        borderTopLeftRadius: msg.role === "user" ? 12 : 0,
                        borderTopRightRadius: msg.role === "user" ? 0 : 12,
                        position: "relative",
                      }}
                      whileHover={{ scale: 1.02 }}
                    >
                      {msg.role === "assistant" ? (
                        <>
                          <div style={{ whiteSpace: "pre-wrap" }}>
                            {msg.content}
                          </div>
                          <div style={styles.actionRow}>
                            <button
                              className="btn-hover"
                              style={styles.copyBtn}
                              onClick={() =>
                                navigator.clipboard.writeText(msg.content)
                              }
                              title="Copy nội dung"
                            >
                              <i className="fas fa-copy"></i>
                            </button>
                            <button
                              className="btn-hover"
                              style={{
                                ...styles.copyBtn,
                                background: isSpeaking ? "#ff4f4f" : undefined,
                                color: isSpeaking ? "#fff" : undefined,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={() => {
                                if (isSpeaking) {
                                  stopSpeaking();
                                } else {
                                  const utterance =
                                    new SpeechSynthesisUtterance(msg.content);
                                  utterance.lang = "vi-VN";
                                  utterance.rate = 0.7;
                                  utterance.pitch = 1.0;
                                  utterance.volume = 1.0;

                                  // Đợi danh sách giọng nói được tải
                                  let voices =
                                    window.speechSynthesis.getVoices();
                                  if (voices.length === 0) {
                                    window.speechSynthesis.onvoiceschanged =
                                      () => {
                                        voices =
                                          window.speechSynthesis.getVoices();
                                        const vietnameseVoice = voices.find(
                                          (voice) =>
                                            voice.name.includes("female") &&
                                            voice.lang.includes("vi")
                                        );
                                        if (vietnameseVoice) {
                                          utterance.voice = vietnameseVoice;
                                        }
                                        window.speechSynthesis.speak(utterance);
                                      };
                                  } else {
                                    const vietnameseVoice = voices.find(
                                      (voice) =>
                                        voice.name.includes("female") &&
                                        voice.lang.includes("vi")
                                    );
                                    if (vietnameseVoice) {
                                      utterance.voice = vietnameseVoice;
                                    }
                                    window.speechSynthesis.speak(utterance);
                                  }

                                  utterance.onend = () => setIsSpeaking(false);
                                  utterance.onerror = () =>
                                    setIsSpeaking(false);
                                  setIsSpeaking(true);
                                }
                              }}
                              title={isSpeaking ? "Dừng đọc" : "Đọc tin nhắn"}
                            >
                              <i
                                className="fas fa-volume-up"
                                style={{
                                  filter: isSpeaking
                                    ? "grayscale(0)"
                                    : "grayscale(0.5)",
                                }}
                              ></i>
                            </button>
                          </div>
                        </>
                      ) : (
                        msg.content
                      )}
                    </motion.div>
                  </motion.div>
                ))}
              </AnimatePresence>
            ) : null}
            {isTyping && (
              <motion.div
                style={{ ...styles.messageRow, justifyContent: "flex-start" }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div
                  style={{
                    ...styles.message,
                    background: "#ececec",
                    color: "#222",
                  }}
                >
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>
          <motion.div
            style={styles.inputContainer}
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            transition={{ duration: 0.6, type: "spring", stiffness: 80 }}
          >
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                isListening ? "Tôi đang nghe đây..." : "Hỏi bất cứ điều gì"
              }
              onKeyDown={(e) => e.key === "Enter" && !isTyping && sendMessage()}
              style={styles.input}
              disabled={isTyping}
            />
            <button
              className="btn-mic-hover"
              style={{
                ...styles.micBtn,
                background: isListening ? "#ffb300" : "#f0f0f0",
                marginRight: 12,
              }}
              onClick={handleMicClick}
              title={
                isListening ? "Đang nghe... Bấm để dừng" : "Nhập bằng giọng nói"
              }
              disabled={isTyping}
            >
              <i className="fas fa-microphone"></i>
            </button>
            {isTyping ? (
              <motion.button
                className="btn-red-hover"
                onClick={handlePause}
                style={{
                  ...styles.button,
                  backgroundColor: "#ff4f4f",
                  marginLeft: 12,
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
              >
                Dừng
              </motion.button>
            ) : (
              <motion.button
                className="btn-blue-hover"
                onClick={sendMessage}
                style={{
                  ...styles.button,
                  backgroundColor: "#007bff",
                  borderTopLeftRadius: 0,
                  borderBottomLeftRadius: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "12px 20px",
                }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                disabled={!message.trim() || isTyping}
              >
                <i className="fas fa-paper-plane"></i>
              </motion.button>
            )}
          </motion.div>
        </div>
      </div>
      <style>{`
        .btn-hover:hover {
          background:rgb(196, 190, 190) !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.08);
          color: #222 !important;
        }
        .btn-blue-hover:hover {
          background: #0056d6 !important;
          color: #fff !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.10);
        }
        .btn-red-hover:hover {
          background: #ff2222 !important;
          color: #fff !important;
          box-shadow: 0 2px 8px rgba(255,0,0,0.10);
        }
        .btn-mic-hover:hover {
          background: #ffe082 !important;
          color: #222 !important;
          box-shadow: 0 2px 8px rgba(255,193,7,0.10);
        }
        .btn-blue-hover {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
      `}</style>
    </>
  );
}

export default App;

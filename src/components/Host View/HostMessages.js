// HostMessages.js
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth, db } from "../../firebase";
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png";
import { Home, Clipboard, User, Gift, MessageSquare, Calendar, Send, Search, Ticket, DollarSign, Bell, LogOut } from "lucide-react";

import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  getDocs,
} from "firebase/firestore";

const HostMessage = () => {
  const [host, setHost] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  const [chats, setChats] = useState([]); // list of chats for this host
  const [activeChat, setActiveChat] = useState(null); // { chatId, otherUser }
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [guestsList, setGuestsList] = useState([]); // to start new chats
  const messagesEndRef = useRef(null);

  // Track logged-in user and fetch host data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // try to fetch host doc from 'hosts' collection
        const hostDoc = await getDoc(doc(db, "hosts", user.uid));
        if (hostDoc.exists()) {
          setHost({ uid: user.uid, ...hostDoc.data() });
        } else {
          // not found in hosts -> force logout or set null
          setHost(null);
        }
      } else {
        setHost(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load all guests (so host can start new chat)
  useEffect(() => {
    const guestsCol = collection(db, "guests");
    const unsub = onSnapshot(guestsCol, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setGuestsList(arr);
    });
    return () => unsub();
  }, []);

  // Load chat list where host participates
  useEffect(() => {
    if (!host) {
      setChats([]);
      return;
    }
    const q = query(collection(db, "messages"), where("participants", "array-contains", host.uid));
    const unsub = onSnapshot(q, async (snap) => {
      const chatPromises = snap.docs.map(async (d) => {
        const data = d.data();
        const otherUid = (data.participants || []).find((id) => id !== host.uid);
        let otherData = null;
        if (otherUid) {
          const guestDoc = await getDoc(doc(db, "guests", otherUid));
          if (guestDoc.exists()) otherData = { id: guestDoc.id, ...guestDoc.data(), role: "guest" };
          else {
            const hostDoc = await getDoc(doc(db, "hosts", otherUid));
            if (hostDoc.exists()) otherData = { id: hostDoc.id, ...hostDoc.data(), role: "host" };
            else otherData = { id: otherUid, fullName: otherUid, role: "unknown" };
          }
        }
        return {
          chatId: d.id,
          lastUpdated: data.lastUpdated ? data.lastUpdated.toMillis?.() : null,
          other: otherData,
        };
      });

      const resolved = await Promise.all(chatPromises);
      resolved.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      setChats(resolved);
    });

    return () => unsub();
  }, [host]);

  // listen to active chat messages
  useEffect(() => {
    if (!activeChat || !activeChat.chatId) {
      setMessages([]);
      return;
    }
    const messagesRef = collection(db, "messages", activeChat.chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setMessages(arr);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 50);
    });

    return () => unsub();
  }, [activeChat]);

  const getChatId = (uidA, uidB) => {
    return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
  };

  const openChatWith = async (other) => {
    if (!host) {
      navigate("/login");
      return;
    }
    const chatId = getChatId(host.uid, other.id);
    const chatDocRef = doc(db, "messages", chatId);
    await setDoc(chatDocRef, { participants: [host.uid, other.id], lastUpdated: serverTimestamp() }, { merge: true });
    setActiveChat({ chatId, otherUser: other });
  };

  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !activeChat) return;
    const messageText = text.trim();
    const chatId = activeChat.chatId;
    const messagesRef = collection(db, "messages", chatId, "messages");

    // optimistic update
    const optimisticMsg = {
      id: "local-" + Date.now(),
      senderId: host.uid,
      receiverId: activeChat.otherUser.id,
      text: messageText,
      timestamp: new Date(),
      local: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

    // ensure chat doc exists
    const chatDocRef = doc(db, "messages", chatId);
    await setDoc(chatDocRef, { participants: [host.uid, activeChat.otherUser.id], lastUpdated: serverTimestamp() }, { merge: true });

    try {
      await addDoc(messagesRef, {
        senderId: host.uid,
        receiverId: activeChat.otherUser.id,
        text: messageText,
        timestamp: serverTimestamp(),
      });
    } catch (err) {
      console.error("Failed to send message:", err);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDropdownOpen(false);
    navigate("/login");
  };

  // UI helper: nav item
  const getNavItem = (path, label, Icon) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${isActive ? "bg-[#FF5A1F] text-white" : "text-[#23364A] hover:bg-gray-100"}`}
      >
        {Icon && <Icon className="w-5 h-5 text-current" />}
        <span className={`${isActive ? "text-white" : "text-[#23364A]"}`}>{label}</span>
      </button>
    );
  };

  return (
    <div className="flex">
      <>
        {/* Mobile Hamburger */}
        <div className="md:hidden fixed top-4 left-4 z-50">
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="p-2 bg-white rounded-md shadow-md"
          >
            <svg
              className="w-6 h-6 text-gray-700"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              {mobileOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Sidebar */}
        <aside
          className={`fixed top-0 left-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between w-[260px] z-40 transition-transform duration-300 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-[260px]"
            }`}
        >
          <div>
            <div className="flex items-center gap-2 px-6 py-6 pl-10 pt-10 w-full max-w-[210px]">
              <img
                src={homezyLogo}
                alt="Homezy Logo"
                className="w-11 h-11 object-contain flex-shrink-0"
              />
              <div className="flex flex-col items-start min-w-0">
                <h1 className="text-[26px] font-bold text-[#23364A] leading-tight truncate">Homezy</h1>
                <span className="mt-1 px-2 py-[2px] rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold shadow border border-white/70 align-middle tracking-wider" style={{letterSpacing: '0.5px', maxWidth: '70px', whiteSpace: 'nowrap'}}>Host</span>
              </div>
            </div>
            <nav className="flex flex-col mt-4">
              {getNavItem("/host-notifications", "Notifications", Bell)}
              <div className="border-t border-gray-300 my-4 mx-6"></div>
              {getNavItem("/dashboard", "Dashboard", Home)}
              {getNavItem("/listings", "My Listings", Clipboard)}
              {getNavItem("/host-messages", "Messages", MessageSquare)}
              {getNavItem("/calendar", "Calendar", Calendar)}
              {getNavItem("/points-rewards", "Points & Rewards", Gift)}
              {getNavItem("/earnings", "Earnings", DollarSign)}
            </nav>
          </div>

          {/* Profile + Logout */}
          <div
            className="flex flex-col items-center gap-4 mb-6 relative px-4"
            ref={dropdownRef}
          >
            <button
              onClick={() =>
                !host ? navigate("/login") : setDropdownOpen(!dropdownOpen)
              }
              className="flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium hover:bg-gray-300 transition w-full"
            >
              {host?.photoURL ? (
                <img
                  src={host.photoURL}
                  alt="profile"
                  className="w-6 h-6 rounded-full object-cover"
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                  {(host?.firstName || host?.email || "H").charAt(0).toUpperCase()}
                </div>
              )}
              <span>{host?.firstName || "Host"}</span>
            </button>

            {host && dropdownOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden z-50">
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    {host.photoURL ? (
                      <img
                        src={host.photoURL}
                        alt="profile"
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg border border-gray-200 flex-shrink-0">
                        {(host.firstName || host.email || "H").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-gray-800 font-semibold text-sm">
                        {host.firstName || "Host"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {host.email || "host@example.com"}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="py-2 text-sm text-gray-700">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/profile");
                    }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <User className="w-4 h-4 text-orange-500" />
                    Profile Settings
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/host-bookings");
                    }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <Calendar className="w-4 h-4 text-orange-500" />
                    Bookings
                  </button>

                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      navigate("/coupons");
                    }}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left"
                  >
                    <Ticket className="w-4 h-4 text-orange-500" />
                    Coupons
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleLogout}
              className="bg-[#B50000] text-white font-medium py-2 w-full rounded-md hover:opacity-90 flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/40 z-30 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
      </>

      <main className="flex flex-col md:flex-row gap-4 md:gap-8 px-4 md:px-10 py-6 md:py-12 w-full md:ml-[260px] md:w-[calc(100%-260px)] min-h-screen font-inter bg-[#F5F6FA]">

        {/* 💬 Sidebar (Chats + Guests) */}
        <aside className="w-full md:w-[340px] bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl shadow-md p-4 md:p-5 h-[60vh] md:h-[80vh] flex flex-col">

          {/* Header */}
          <div className="flex items-center justify-between mb-3 md:mb-5">
            <h2 className="text-2xl sm:text-[32px] font-bold mb-2 flex items-center gap-2">
              <span className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                <MessageSquare className="w-7 h-7" />
              </span>
              Messages
            </h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Real-time
            </span>
          </div>

          {/* 🔍 Search */}
          <div className="flex items-center gap-2 mb-3 bg-gray-50 border rounded-full px-3 py-2 shadow-inner">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              className="w-full bg-transparent outline-none text-sm"
              placeholder="Search guests..."
              onChange={() => { }}
            />
          </div>

          {/* 💭 Chats List */}
          <div className="flex-1 overflow-auto pr-1">
            {chats.length === 0 ? (
              <p className="text-sm text-gray-500 text-center mt-4">
                No conversations yet.
                <br />
                <span className="text-orange-500 font-medium">Start a chat below 👇</span>
              </p>
            ) : (
              <ul className="space-y-2">
                {chats.map((c) => (
                  <li key={c.chatId}>
                    <button
                      onClick={() => setActiveChat({ chatId: c.chatId, otherUser: c.other })}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all duration-200 ${activeChat?.chatId === c.chatId
                        ? "bg-gradient-to-r from-orange-50 to-white shadow-sm"
                        : "hover:bg-gray-50"
                        }`}
                    >
                      {c.other?.photoURL ? (
                        <img
                          src={c.other.photoURL}
                          alt="pfp"
                          className="w-10 h-10 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg border border-gray-200 flex-shrink-0">
                          {(c.other?.fullName || c.other?.firstName || c.other?.email || "U").charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-[#0B2545] truncate">
                            {c.other?.fullName || c.other?.firstName || "Unknown"}
                          </p>
                          <span className="text-[11px] text-gray-400 whitespace-nowrap">
                            {c.lastUpdated
                              ? new Date(c.lastUpdated).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                              : ""}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate text-left">
                          Tap to open chat
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <hr className="my-3 md:my-4 border-gray-200" />

          {/* 🧑‍🍳 Guests List */}
          <div className="flex-1 overflow-auto">
            <h3 className="text-sm font-semibold text-[#0B2545] mb-2 md:mb-3">
              Start a new chat
            </h3>
            <ul className="space-y-2">
              {guestsList.map((g) => (
                <li key={g.uid || g.id}>
                  <button
                    onClick={() => openChatWith(g)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-200"
                  >
                    {g.photoURL ? (
                      <img
                        src={g.photoURL}
                        alt="guest"
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg border border-gray-200 flex-shrink-0">
                        {(g.fullName || g.firstName || g.email || "G").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[#0B2545] text-left">
                        {g.fullName || g.firstName || "Guest"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{g.email}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* 💌 Chat Window */}
        <section className="flex-1 flex flex-col h-[60vh] md:h-[80vh] bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl shadow-md overflow-hidden">

          {/* Header */}
          <div className="px-4 md:px-5 py-3 md:py-4 border-b flex items-center gap-3 md:gap-4 bg-gradient-to-r from-orange-50 to-white">
            {activeChat ? (
              <>
                {activeChat.otherUser.photoURL ? (
                  <img
                    src={activeChat.otherUser.photoURL}
                    alt="other"
                    className="w-10 md:w-12 h-10 md:h-12 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 md:w-12 h-10 md:h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg md:text-xl border border-gray-200 flex-shrink-0">
                    {(activeChat.otherUser.fullName || activeChat.otherUser.firstName || activeChat.otherUser.email || "U").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-base md:text-lg text-[#0B2545]">
                    {activeChat.otherUser.fullName || activeChat.otherUser.firstName}
                  </div>
                  <div className="text-xs text-gray-500">Guest</div>
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-sm">
                Select a guest or chat to start messaging 💭
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 md:p-5 overflow-auto bg-gradient-to-b from-white to-gray-50">
            {!activeChat ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                No conversation selected
              </div>
            ) : (
              <div className="space-y-3 md:space-y-4 max-w-full md:max-w-3xl mx-auto">
                {messages.map((m) => {
                  const isMe = m.senderId === host?.uid;
                  const ts = m.timestamp?.toDate
                    ? m.timestamp.toDate()
                    : m.timestamp instanceof Date
                      ? m.timestamp
                      : null;

                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`px-3 md:px-4 py-2.5 rounded-2xl shadow-sm max-w-[80%] md:max-w-[70%] transition-all ${isMe
                          ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-br-none"
                          : "bg-white border border-gray-200 text-gray-700 rounded-bl-none"
                          }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                        <p className={`text-[11px] mt-1 ${isMe ? "text-orange-100" : "text-gray-400"} text-right`}>
                          {ts
                            ? ts.toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                            : "..."}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="px-3 md:px-5 py-3 md:py-4 border-t bg-white/70 backdrop-blur-md">
            <div className="flex items-center gap-2 md:gap-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  activeChat
                    ? `Message ${activeChat.otherUser.firstName || activeChat.otherUser.fullName}...`
                    : "Select a conversation to start"
                }
                className="flex-1 px-3 md:px-4 py-2.5 md:py-3 rounded-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-sm md:text-base"
                disabled={!activeChat}
              />
              <button
                type="submit"
                disabled={!activeChat || !text.trim()}
                className="p-2.5 md:p-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:scale-105 transition-all disabled:opacity-60"
              >
                <Send className="w-4 md:w-5 h-4 md:h-5" />
              </button>
            </div>
          </form>
        </section>
      </main>

    </div>
  );
};

export default HostMessage;

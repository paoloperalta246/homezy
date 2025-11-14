// GuestMessages.js
import React, { useState, useRef, useEffect } from "react";
import logo from "./homezy-logo.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { auth, db } from "../../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import defaultProfile from "./images/default-profile.png";
import {
  User,
  Calendar,
  Heart,
  LogOut,
  MessageCircle,
  Search,
  Send,
  Bell,
} from "lucide-react";

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

const GuestMessages = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const DropdownPortal = ({ children }) => {
    return createPortal(
      children,
      document.body // render directly in body
    );
  };

  const dropdownButtonRef = useRef(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownMenuRef = useRef(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState(null); // firebase auth user
  const [chats, setChats] = useState([]); // list of chat docs (chatId + otherUser data)
  const [activeChat, setActiveChat] = useState(null); // { chatId, otherUser }
  const [messages, setMessages] = useState([]); // messages in active chat
  const [text, setText] = useState("");
  const [hostsList, setHostsList] = useState([]); // list of hosts to start new convos
  const messagesEndRef = useRef(null);

  // Track user login
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribe();
  }, []);

  // 👇 add this after your other useEffects
  useEffect(() => {
    function handleClickOutside(e) {
      if (
        dropdownOpen &&
        dropdownMenuRef.current &&
        !dropdownMenuRef.current.contains(e.target) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(e.target)
      ) {
        setDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [dropdownOpen]);


  // Load all hosts (so guest can start chat with any host)
  useEffect(() => {
    const hostsCol = collection(db, "hosts");
    const unsub = onSnapshot(hostsCol, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHostsList(arr);
    });
    return () => unsub();
  }, []);

  // Load chat list where current user participates
  useEffect(() => {
    if (!user) {
      setChats([]);
      return;
    }
    const q = query(collection(db, "messages"), where("participants", "array-contains", user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      // For each chat doc, find the other participant's basic info
      const chatPromises = snap.docs.map(async (d) => {
        const data = d.data();
        const otherUid = (data.participants || []).find((id) => id !== user.uid);
        // try to get host data
        let otherData = null;
        if (otherUid) {
          // first check hosts collection (guest's chats are with hosts)
          const hostDoc = await getDoc(doc(db, "hosts", otherUid));
          if (hostDoc.exists()) otherData = { id: hostDoc.id, ...hostDoc.data(), role: "host" };
          else {
            // fallback: try guests collection
            const guestDoc = await getDoc(doc(db, "guests", otherUid));
            if (guestDoc.exists()) otherData = { id: guestDoc.id, ...guestDoc.data(), role: "guest" };
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
      // sort by lastUpdated desc
      resolved.sort((a, b) => (b.lastUpdated || 0) - (a.lastUpdated || 0));
      setChats(resolved);
    });

    return () => unsub();
  }, [user]);

  // Listen to messages in active chat in real-time
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
      // scroll to bottom on new messages
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }, 50);
    });

    return () => unsub();
  }, [activeChat]);

  // helper: deterministic chatId for two uids
  const getChatId = (uidA, uidB) => {
    return uidA < uidB ? `${uidA}_${uidB}` : `${uidB}_${uidA}`;
  };

  // open or create chat with host
  const openChatWith = async (other) => {
    if (!user) {
      navigate("/login");
      return;
    }
    const chatId = getChatId(user.uid, other.id);
    // ensure chat doc exists with participants
    const chatDocRef = doc(db, "messages", chatId);
    await setDoc(chatDocRef, { participants: [user.uid, other.id], lastUpdated: serverTimestamp() }, { merge: true });
    setActiveChat({ chatId, otherUser: other });
  };

  // If navigated with state (hostId, hostName), open chat automatically
  useEffect(() => {
    if (location.state && location.state.hostId && user) {
      // Find host in hostsList or create minimal object
      const host = hostsList.find(h => h.id === location.state.hostId) || {
        id: location.state.hostId,
        fullName: location.state.hostName || "Host",
        role: "host"
      };
      openChatWith(host);
    }
    // Only run when hostsList, user, or location.state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, hostsList, user]);

  // send message
  const sendMessage = async (e) => {
    e?.preventDefault();
    if (!text.trim() || !activeChat) return;
    const messageText = text.trim();
    const chatId = activeChat.chatId;
    const messagesRef = collection(db, "messages", chatId, "messages");

    // optimistic local update
    const optimisticMsg = {
      id: "local-" + Date.now(),
      senderId: user.uid,
      receiverId: activeChat.otherUser.id,
      text: messageText,
      timestamp: new Date(),
      local: true,
    };
    setMessages((prev) => [...prev, optimisticMsg]);
    setText("");
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });

    // ensure chat doc has lastUpdated and participants
    const chatDocRef = doc(db, "messages", chatId);
    await setDoc(chatDocRef, { participants: [user.uid, activeChat.otherUser.id], lastUpdated: serverTimestamp() }, { merge: true });

    try {
      await addDoc(messagesRef, {
        senderId: user.uid,
        receiverId: activeChat.otherUser.id,
        text: messageText,
        timestamp: serverTimestamp(),
      });
      // Firestore onSnapshot will update messages list; optimistic entry will remain but server entry shows too
    } catch (err) {
      console.error("Failed to send message:", err);
      // Optionally: mark optimistic message as failed
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* HEADER */}
      <header className="sticky top-0 left-0 w-full bg-white/95 backdrop-blur-md border-b border-gray-100 shadow-sm z-50">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between px-4 sm:px-12 py-4">
          {/* 🏠 Logo */}
          <Link
            to="/"
            className="flex items-center gap-2.5 hover:opacity-90 transition-opacity"
          >
            <img src={logo} alt="Homezy Logo" className="w-10 h-10 object-contain" />
            <h1 className="text-[#0B2545] text-2xl font-bold tracking-tight">
              Homezy
            </h1>
          </Link>

          {/* 🍔 Hamburger (mobile only) */}
          <button
            className="sm:hidden flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-100 transition"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-6 h-6"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d={
                  mobileMenuOpen
                    ? "M6 18L18 6M6 6l12 12"
                    : "M4 6h16M4 12h16M4 18h16"
                }
              />
            </svg>
          </button>

          {/* 🧭 Desktop Navigation */}
          <div className="hidden sm:flex sm:items-center sm:gap-8 text-[#0B2545] font-medium text-sm">
            {/* Navigation Links */}
            <div className="flex items-center gap-6">
              <Link
                to="/homes"
                className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-gradient-to-r after:from-orange-500 after:to-orange-400 after:transition-all duration-300 ${location.pathname === "/homes"
                  ? "after:w-full"
                  : "after:w-0 hover:after:w-full"
                  }`}
              >
                Homes
              </Link>

              <Link
                to="/experiences"
                className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-gradient-to-r after:from-orange-500 after:to-orange-400 after:transition-all duration-300 ${location.pathname === "/experiences"
                  ? "after:w-full"
                  : "after:w-0 hover:after:w-full"
                  }`}
              >
                Experiences
              </Link>

              <Link
                to="/services"
                className={`relative pb-1 after:content-[''] after:absolute after:left-0 after:bottom-0 after:h-[2px] after:bg-gradient-to-r after:from-orange-500 after:to-orange-400 after:transition-all duration-300 ${location.pathname === "/services"
                  ? "after:w-full"
                  : "after:w-0 hover:after:w-full"
                  }`}
              >
                Services
              </Link>
            </div>

            {/* ✨ Become a Host */}
            <button
              onClick={() => navigate("/host-verification")}
              className="bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
            >
              Become a Host
            </button>

            {/* 🔔 Notifications Bell */}
            {user && (
              <button
                onClick={() => navigate("/guest-notifications")}
                className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Bell className="w-5 h-5 text-gray-700" />
              </button>
            )}

            {/* 👤 User Dropdown */}
            <div className="relative">
              <button
                ref={dropdownButtonRef}
                onClick={() => {
                  if (!user) navigate("/login");
                  else setDropdownOpen(!dropdownOpen);
                }}
                className="flex items-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium hover:bg-gray-300 transition"
              >
                {!user ? (
                  <>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                      className="w-5 h-5"
                    >
                      <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 
                             1.79-4 4 1.79 4 4 4zm0 2c-3.31 
                             0-6 2.69-6 6h12c0-3.31-2.69-6-6-6z" />
                    </svg>
                    <span>Log In / Sign Up</span>
                  </>
                ) : (
                  <>
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt="profile"
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span>{user.displayName || "User"}</span>
                  </>
                )}
              </button>

              {user && dropdownOpen && (
                <DropdownPortal>
                  <div
                    ref={dropdownMenuRef}
                    className="absolute w-56 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 z-[99999]"
                    style={{
                      top: dropdownButtonRef.current
                        ? dropdownButtonRef.current.getBoundingClientRect().bottom + window.scrollY
                        : undefined,
                      left: dropdownButtonRef.current
                        ? dropdownButtonRef.current.getBoundingClientRect().left + window.scrollX
                        : undefined,
                    }}
                  >
                    <div className="p-3 border-b border-gray-100">
                      <div className="flex items-center gap-3">
                        {user.photoURL ? (
                          <img
                            src={user.photoURL}
                            alt="profile"
                            className="w-10 h-10 rounded-full object-cover border border-gray-200"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg border border-gray-200 flex-shrink-0">
                            {(user.displayName || user.email || "U").charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="text-gray-800 font-semibold text-sm">
                            {user.displayName || "Guest User"}
                          </p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </div>

                    <div className="py-2 text-sm text-gray-700">
                      <Link
                        to="/guest-profile"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4 text-orange-500" />
                        Profile Settings
                      </Link>
                      <Link
                        to="/bookings"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <Calendar className="w-4 h-4 text-orange-500" />
                        Bookings
                      </Link>
                      <Link
                        to="/guest-messages"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <MessageCircle className="w-4 h-4 text-orange-500" />
                        Messages
                      </Link>
                      <Link
                        to="/favorites"
                        className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors"
                      >
                        <Heart className="w-4 h-4 text-orange-500" />
                        Favorites
                      </Link>
                    </div>

                    <div className="border-t border-gray-100 py-2">
                      <button
                        onClick={async () => {
                          await signOut(auth);
                          setDropdownOpen(false);
                          navigate("/login");
                        }}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:bg-red-50 w-full text-left transition-colors"
                      >
                        <LogOut className="w-4 h-4 text-red-600" />
                        Logout
                      </button>
                    </div>
                  </div>
                </DropdownPortal>
              )}
            </div>
          </div>
        </div>

        {/* 📱 Mobile Menu Dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-white border-t border-gray-100 shadow-md">
            <div className="flex flex-col items-center gap-4 py-6 text-[#0B2545] font-medium text-sm">
              <Link
                to="/homes"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-orange-500 transition"
              >
                Homes
              </Link>
              <Link
                to="/experiences"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-orange-500 transition"
              >
                Experiences
              </Link>
              <Link
                to="/services"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-orange-500 transition"
              >
                Services
              </Link>

              <button
                onClick={() => {
                  navigate("/host-verification");
                  setMobileMenuOpen(false);
                }}
                className="bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white font-semibold px-5 py-2.5 rounded-lg shadow-sm transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Become a Host
              </button>

              {user ? (
                <>
                  <Link
                    to="/guest-notifications"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <Bell className="w-4 h-4 text-orange-500" /> Notifications
                  </Link>
                  <Link
                    to="/guest-profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <User className="w-4 h-4 text-orange-500" /> Profile Settings
                  </Link>
                  <Link
                    to="/bookings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <Calendar className="w-4 h-4 text-orange-500" /> Bookings
                  </Link>
                  <Link
                    to="/guest-messages"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <MessageCircle className="w-4 h-4 text-orange-500" /> Messages
                  </Link>
                  <Link
                    to="/favorites"
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-2 text-gray-700 hover:text-orange-500"
                  >
                    <Heart className="w-4 h-4 text-orange-500" /> Favorites
                  </Link>

                  <button
                    onClick={async () => {
                      await signOut(auth);
                      setMobileMenuOpen(false);
                      navigate("/login");
                    }}
                    className="flex items-center gap-2 text-red-500 hover:text-red-600"
                  >
                    <LogOut className="w-4 h-4" /> Logout
                  </button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/login");
                  }}
                  className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded-md font-medium transition"
                >
                  Log In / Sign Up
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {/* main content: left column (hosts/chat list) + right chat window */}
      <main className="flex flex-col md:flex-row gap-4 md:gap-6 px-4 sm:px-8 py-6 md:py-10 max-w-7xl mx-auto font-inter">
        {/* 💬 Sidebar (Chats + Hosts) */}
        <aside className="w-full md:w-[340px] bg-white/70 backdrop-blur-md border border-gray-200 rounded-2xl shadow-md p-4 sm:p-5 h-[60vh] md:h-[80vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="text-lg sm:text-xl font-bold text-[#0B2545] flex items-center gap-2">
              💬 Messages
            </h2>
            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
              Real-time
            </span>
          </div>

          {/* 🔍 Search */}
          <div className="flex items-center gap-2 mb-3 sm:mb-4 bg-gray-50 border rounded-full px-3 py-2 shadow-inner">
            <Search className="w-4 h-4 text-gray-400" />
            <input
              className="w-full bg-transparent outline-none text-sm"
              placeholder="Search hosts..."
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
                      onClick={() =>
                        setActiveChat({ chatId: c.chatId, otherUser: c.other })
                      }
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
                          {(c.other?.fullName || c.other?.firstName || c.other?.email || "H").charAt(0).toUpperCase()}
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

          <hr className="my-3 sm:my-4 border-gray-200" />

          {/* 🧑‍🍳 Hosts List */}
          <div className="flex-1 overflow-auto">
            <h3 className="text-sm font-semibold text-[#0B2545] mb-2 sm:mb-3">
              Start a new chat
            </h3>
            <ul className="space-y-2">
              {hostsList.map((h) => (
                <li key={h.uid || h.id}>
                  <button
                    onClick={() => openChatWith(h)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-all duration-200"
                  >
                    {h.photoURL ? (
                      <img
                        src={h.photoURL}
                        alt="host"
                        className="w-10 h-10 rounded-full object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg border border-gray-200 flex-shrink-0">
                        {(h.fullName || h.firstName || h.email || "H").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-[#0B2545] text-left">
                        {h.fullName || h.firstName || "Host"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">{h.email}</p>
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
          <div className="px-4 sm:px-5 py-3 sm:py-4 border-b flex items-center gap-3 sm:gap-4 bg-gradient-to-r from-orange-50 to-white">
            {activeChat ? (
              <>
                {activeChat.otherUser.photoURL ? (
                  <img
                    src={activeChat.otherUser.photoURL}
                    alt="other"
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover border border-gray-200"
                  />
                ) : (
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-lg sm:text-xl border border-gray-200 flex-shrink-0">
                    {(activeChat.otherUser.fullName || activeChat.otherUser.firstName || activeChat.otherUser.email || "H").charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="font-semibold text-base sm:text-lg text-[#0B2545]">
                    {activeChat.otherUser.fullName || activeChat.otherUser.firstName}
                  </div>
                  <div className="text-xs text-gray-500">Host</div>
                </div>
              </>
            ) : (
              <div className="text-gray-500 text-sm">
                Select a host or chat to start messaging 💭
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 sm:p-5 overflow-auto bg-gradient-to-b from-white to-gray-50">
            {!activeChat ? (
              <div className="h-full flex items-center justify-center text-gray-400 text-sm sm:text-base">
                No conversation selected
              </div>
            ) : (
              <div className="space-y-4 max-w-full sm:max-w-3xl mx-auto">
                {messages.map((m) => {
                  const isMe = m.senderId === user?.uid;
                  const ts = m.timestamp?.toDate
                    ? m.timestamp.toDate()
                    : m.timestamp instanceof Date
                      ? m.timestamp
                      : null;

                  return (
                    <div
                      key={m.id}
                      className={`flex ${isMe ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`px-3 sm:px-4 py-2.5 rounded-2xl shadow-sm max-w-[70%] transition-all ${isMe
                          ? "bg-gradient-to-r from-orange-400 to-orange-500 text-white rounded-br-none"
                          : "bg-white border border-gray-200 text-gray-700 rounded-bl-none"
                          }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{m.text}</p>
                        <p
                          className={`text-[11px] mt-1 ${isMe ? "text-orange-100" : "text-gray-400"} text-right`}
                        >
                          {ts
                            ? ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
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
          <form
            onSubmit={sendMessage}
            className="px-4 sm:px-5 py-3 sm:py-4 border-t bg-white/70 backdrop-blur-md"
          >
            <div className="flex items-center gap-2 sm:gap-3">
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  activeChat
                    ? `Message ${activeChat.otherUser.firstName || activeChat.otherUser.fullName}...`
                    : "Select a conversation to start"
                }
                className="flex-1 px-3 sm:px-4 py-2.5 rounded-full border border-gray-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-sm sm:text-base"
                disabled={!activeChat}
              />
              <button
                type="submit"
                disabled={!activeChat || !text.trim()}
                className="p-3 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white hover:scale-105 transition-all disabled:opacity-60"
              >
                <Send className="w-4 sm:w-5 h-4 sm:h-5" />
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
};

export default GuestMessages;

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { getEmailEndpoint } from "../../utils/api";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  getDocs,
  getDoc,
  addDoc
} from "firebase/firestore";

import { auth, db } from "../../firebase"; // ✅ Import your Firebase config
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png"; // ✅ Add this image
import { Home, Clipboard, User, Gift, MessageSquare, Calendar, Ticket, Users, CreditCard, XCircle, DollarSign, Bell, LogOut } from "lucide-react";
import { Link } from "react-router-dom";

const HostNotifications = () => {
  const [activeTab, setActiveTab] = useState("all");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(null); // ✅ Host data
  const [dropdownOpen, setDropdownOpen] = useState(false); // ✅ Added
  const dropdownRef = useRef(null); // ✅ Added
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const currentPath = location.pathname;
  const pendingBookings = bookings.filter(b => b.status === "pending");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [notifications, setNotifications] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalAction, setModalAction] = useState(null);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [selectedNotif, setSelectedNotif] = useState(null);
  const [notificationType, setNotificationType] = useState(null);
  const unreadCount = bookings.filter(notif => notif.read === false).length;
  const [processingNotifs, setProcessingNotifs] = useState(new Set());
  const [successMessage, setSuccessMessage] = useState(null);
  const [disabledNotifs, setDisabledNotifs] = useState(new Set());
  const [notifStatus, setNotifStatus] = useState({});

  // Filter and search logic
  const getFilteredNotifications = () => {
    let filtered = [...bookings];

    // Apply search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(notif =>
        notif.guestName?.toLowerCase().includes(search) ||
        notif.guestEmail?.toLowerCase().includes(search) ||
        notif.listingTitle?.toLowerCase().includes(search)
      );
    }

    // Apply type filter
    if (activeTab === "bookings") {
      filtered = filtered.filter(notif => notif.type !== "cancellation_request");
    } else if (activeTab === "cancellations") {
      filtered = filtered.filter(notif => notif.type === "cancellation_request");
    }
    // "all" shows everything, no filter needed

    return filtered;
  };

  const filteredNotifications = getFilteredNotifications();

  const openModal = (action, bookingId, notifId, type = null) => {
    setModalAction(action);
    setSelectedBooking(bookingId);
    setSelectedNotif(notifId);
    setNotificationType(type);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalAction(null);
    setSelectedBooking(null);
    setSelectedNotif(null);
    setNotificationType(null);
  };

  const confirmAction = async () => {
    // Immediately add to disabled set for instant UI feedback
    setDisabledNotifs(prev => new Set([...prev, selectedNotif]));
    
    // Set status immediately for badge display
    const status = modalAction === "approve" ? 'approved' : 'rejected';
    setNotifStatus(prev => ({
      ...prev,
      [selectedNotif]: status
    }));
    
    try {
      if (modalAction === "approve") {
        if (notificationType === 'cancellation_request') {
          await handleApproveCancellation(selectedBooking, selectedNotif);
          setSuccessMessage({ type: 'success', message: 'Cancellation approved! Guest booking has been removed.' });
        } else {
          await handleApprove(selectedBooking, selectedNotif);
          setSuccessMessage({ type: 'success', message: 'Booking approved successfully! Guest has been notified.' });
        }
      } else if (modalAction === "reject") {
        if (notificationType === 'cancellation_request') {
          await handleRejectCancellation(selectedBooking, selectedNotif);
          setSuccessMessage({ type: 'error', message: 'Cancellation request denied! Guest has been notified.' });
        } else {
          await handleReject(selectedBooking, selectedNotif);
          setSuccessMessage({ type: 'error', message: 'Booking rejected successfully! Guest has been notified.' });
        }
      }
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (error) {
      console.error('Error processing action:', error);
      setSuccessMessage({ type: 'error', message: 'Failed to process booking. Please try again.' });
      setTimeout(() => setSuccessMessage(null), 5000);
      // Remove from disabled set and status if there was an error
      setDisabledNotifs(prev => {
        const newSet = new Set(prev);
        newSet.delete(selectedNotif);
        return newSet;
      });
      setNotifStatus(prev => {
        const newStatus = { ...prev };
        delete newStatus[selectedNotif];
        return newStatus;
      });
    }
    closeModal();
  };

  useEffect(() => {
    if (!host) return;

    const q = query(
      collection(db, "notifications"),
      where("hostId", "==", host.uid),
      orderBy("timestamp", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      console.log("📋 Notifications fetched:", notifData);
      setBookings(notifData); // or setNotifications if you rename it
      setLoading(false);
    });

    return () => unsubscribe();
  }, [host]);

  // 🔥 Track logged-in user and fetch their Firestore data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "hosts", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setHost(docSnap.data());
        } else {
          console.log("No host data found for this user");
        }
      } // <-- close the if(user) block
    }); // <-- close onAuthStateChanged callback

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!host) return; // wait until host data is loaded

    const fetchNotifications = async () => {
      setLoading(true);
      try {
        const notificationsRef = collection(db, "notifications");
        const q = query(notificationsRef, where("hostId", "==", auth.currentUser.uid));
        const querySnapshot = await getDocs(q);

        const notifs = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Sort newest first
        notifs.sort((a, b) => b.timestamp?.toDate() - a.timestamp?.toDate());

        setNotifications(notifs);
      } catch (error) {
        console.error("Error fetching notifications:", error);
      }
      setLoading(false);
    };

    fetchNotifications();
  }, [host]);

  // ✅ Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleNavigation = (path) => {
    navigate(path);
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDropdownOpen(false);
    navigate("/login");
  };

  const getNavItem = (path, label, Icon, badge) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={`flex items-center justify-between gap-3 px-6 py-3 font-medium transition rounded-md ${isActive ? "bg-[#FF5A1F] text-white" : "text-[#23364A] hover:bg-gray-100"
          }`}
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5 text-current" />}
          <span className={`${isActive ? "text-white" : "text-[#23364A]"}`}>{label}</span>
        </div>

        {badge > 0 && (
          <span className="inline-flex items-center justify-center px-2 py-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {badge}
          </span>
        )}
      </button>
    );
  };

  useEffect(() => {
    const markAsRead = async () => {
      const unreadNotifs = bookings.filter(n => !n.read);
      for (let notif of unreadNotifs) {
        await updateDoc(doc(db, "notifications", notif.id), { read: true });
      }
    };

    markAsRead();
  }, [bookings]);


  return (
    <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans max-w-full overflow-x-hidden">
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
              {getNavItem("/host-notifications", "Notifications", Bell, unreadCount)}
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

      {/* ===== Main Content ===== */}
      <main className="flex-1 px-4 sm:px-8 md:px-16 py-6 sm:py-10 md:ml-[260px] pt-16 sm:pt-10 max-w-full overflow-x-hidden">
        <h2 className="text-xl sm:text-2xl md:text-[32px] font-bold mb-2 flex items-center gap-2">
          <span className="p-1.5 sm:p-2 rounded-xl bg-orange-500/10 text-orange-600">
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
          </span>
          Notifications
        </h2>
        <p className="text-[#5E6282] text-sm sm:text-base md:text-lg mb-4">Stay updated with the latest guest activities and system alerts.</p>

        {/* Success/Error Message */}
        {successMessage && (
          <div className={`mb-4 sm:mb-6 p-3 sm:p-4 rounded-xl shadow-lg animate-in slide-in-from-top duration-300 ${
            successMessage.type === 'success' 
              ? 'bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-500' 
              : 'bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-500'
          }`}>
            <div className="flex items-start sm:items-center gap-2 sm:gap-3">
              <div className={`p-1.5 sm:p-2 rounded-full flex-shrink-0 ${
                successMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
              }`}>
                {successMessage.type === 'success' ? (
                  <svg className="w-4 h-4 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <XCircle className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold text-sm sm:text-base ${
                  successMessage.type === 'success' ? 'text-green-800' : 'text-red-800'
                }`}>
                  {successMessage.message}
                </p>
              </div>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-gray-500 hover:text-gray-700 transition flex-shrink-0"
              >
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="flex flex-col gap-2 sm:gap-3 mb-4 sm:mb-6">
          {/* Search */}
          <div className="relative flex gap-2">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-2 sm:pl-3 flex items-center pointer-events-none">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search notifications..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 py-2 bg-white border border-gray-300 rounded-lg text-xs sm:text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="px-3 sm:px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs sm:text-sm font-medium text-gray-700 transition-all whitespace-nowrap"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeTab === "all"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              All Notifications
            </button>
            <button
              onClick={() => setActiveTab("bookings")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeTab === "bookings"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              Booking Requests
            </button>
            <button
              onClick={() => setActiveTab("cancellations")}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${activeTab === "cancellations"
                ? "bg-orange-500 text-white shadow-md"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
            >
              Cancellation Requests
            </button>
          </div>
        </div>

        {/* Notifications List */}
        <div className="mt-8 space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-orange-500 mb-4"></div>
              <p className="text-gray-600 font-medium">Loading notifications...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl">
              <div className="bg-white p-6 rounded-full shadow-lg mb-4">
                <Bell className="w-12 h-12 text-gray-400" />
              </div>
              <p className="text-gray-600 text-lg font-semibold mb-2">
                {searchTerm || activeTab !== "all" ? "No matching notifications" : "No notifications yet"}
              </p>
              <p className="text-gray-500 text-sm">
                {searchTerm || activeTab !== "all"
                  ? "Try adjusting your search or filter criteria"
                  : "You're all caught up! New booking requests will appear here."}
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif, index) => (
              <div
                key={notif.id}
                className="group relative bg-gradient-to-br from-white to-gray-50 border-2 border-gray-200 rounded-2xl shadow-lg hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {/* Gradient accent bar */}
                <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-orange-400 to-orange-600"></div>

                <div className="p-4 sm:p-6 pl-6 sm:pl-8">
                  <div className="flex flex-col lg:flex-row justify-between items-start gap-4 sm:gap-6">
                    {/* Notification Details */}
                    <div className="flex-1 space-y-3 sm:space-y-4 min-w-0">
                      {/* Header with listing title */}
                      <div className="flex items-start gap-2 sm:gap-3">
                        <div className={`bg-gradient-to-br p-2 sm:p-3 rounded-xl flex-shrink-0 ${ 
                          notif.type === 'cancellation_request' 
                            ? 'from-red-100 to-red-200' 
                            : 'from-orange-100 to-orange-200'
                        }`}>
                          {notif.type === 'cancellation_request' ? (
                            <XCircle className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-red-600" />
                          ) : (
                            <Home className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-orange-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                            <h3 className="font-bold text-gray-900 text-base sm:text-lg md:text-xl break-words">
                              {notif.listingTitle || "Unknown Property"}
                            </h3>
                            {(notif.processed || notifStatus[notif.id]) && (
                              <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-bold w-fit ${
                                (notif.status === 'rejected' || notifStatus[notif.id] === 'rejected')
                                  ? 'bg-red-100 text-red-700 border border-red-300'
                                  : 'bg-green-100 text-green-700 border border-green-300'
                              }`}>
                                {(notif.status === 'rejected' || notifStatus[notif.id] === 'rejected') ? 'Rejected' : 'Approved'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs sm:text-sm text-gray-600 font-medium">
                            {notif.type === 'cancellation_request' ? (
                              <>
                                <span className="text-red-600 font-bold">Cancellation Request</span> from <span className="text-orange-600">{notif.guestName || "Guest"}</span>
                              </>
                            ) : (
                              <>
                                New booking request from <span className="text-orange-600">{notif.guestName || "Guest"}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 bg-white/60 backdrop-blur-sm rounded-xl p-3 sm:p-4 border border-gray-100">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="bg-blue-100 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Guest Email</p>
                            <p className="text-xs sm:text-sm text-gray-800 font-semibold truncate">{notif.guestEmail || "N/A"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="bg-purple-100 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                            <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" />
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Total Guests</p>
                            <p className="text-xs sm:text-sm text-gray-800 font-semibold">{notif.guests || "N/A"}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="bg-green-100 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" />
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Check-in</p>
                            <p className="text-xs sm:text-sm text-gray-800 font-semibold">
                              {notif.checkIn ? new Date(notif.checkIn.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "N/A"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="bg-red-100 p-1.5 sm:p-2 rounded-lg flex-shrink-0">
                            <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                          </div>
                          <div>
                            <p className="text-[10px] sm:text-xs text-gray-500 font-medium">Check-out</p>
                            <p className="text-xs sm:text-sm text-gray-800 font-semibold">
                              {notif.checkOut ? new Date(notif.checkOut.seconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Price and Timestamp */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                          <CreditCard className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
                          <span className="text-xs sm:text-sm text-gray-600 whitespace-nowrap">Total Price:</span>
                          <span className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-orange-600 to-orange-500 bg-clip-text text-transparent">
                            ₱{notif.finalPrice?.toLocaleString() || "N/A"}.00
                          </span>
                        </div>
                        <div className="text-left sm:text-right">
                          <p className="text-[10px] sm:text-xs text-gray-400">
                            {notif.timestamp ? new Date(notif.timestamp.seconds * 1000).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : "N/A"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex lg:flex-col gap-2 sm:gap-3 w-full lg:w-auto">
                      <button
                        disabled={notif.processed || disabledNotifs.has(notif.id)}
                        className={`flex-1 lg:flex-none lg:w-36 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-lg font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200 text-sm sm:text-base ${
                          notif.processed || disabledNotifs.has(notif.id)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white hover:shadow-xl transform hover:scale-105'
                        }`}
                        onClick={() => !(notif.processed || disabledNotifs.has(notif.id)) && openModal("approve", notif.bookingId, notif.id, notif.type)}
                      >
                        <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {notif.type === 'cancellation_request' ? 'Allow' : 'Approve'}
                      </button>
                      <button
                        disabled={notif.processed || disabledNotifs.has(notif.id)}
                        className={`flex-1 lg:flex-none lg:w-36 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-lg font-semibold flex items-center justify-center gap-1.5 sm:gap-2 transition-all duration-200 text-sm sm:text-base ${
                          notif.processed || disabledNotifs.has(notif.id)
                            ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                            : 'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white hover:shadow-xl transform hover:scale-105'
                        }`}
                        onClick={() => !(notif.processed || disabledNotifs.has(notif.id)) && openModal("reject", notif.bookingId, notif.id, notif.type)}
                      >
                        <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                        {notif.type === 'cancellation_request' ? 'Deny' : 'Reject'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </main>
      {/* Confirmation Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex justify-center items-center z-50 animate-in fade-in duration-200 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-200">
            {/* Modal Header with gradient */}
            <div className={`p-4 sm:p-6 ${modalAction === "approve"
              ? "bg-gradient-to-r from-green-500 to-green-600"
              : "bg-gradient-to-r from-red-500 to-red-600"
              }`}>
              <div className="flex items-center justify-center mb-2 sm:mb-3">
                <div className="bg-white/20 backdrop-blur-sm p-3 sm:p-4 rounded-full">
                  {modalAction === "approve" ? (
                    <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <XCircle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                  )}
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-white text-center">
                {notificationType === 'cancellation_request' ? (
                  modalAction === "approve"
                    ? "Allow Cancellation?"
                    : "Deny Cancellation?"
                ) : (
                  modalAction === "approve"
                    ? "Approve Booking?"
                    : "Reject Booking?"
                )}
              </h3>
            </div>

            {/* Modal Body */}
            <div className="p-4 sm:p-6">
              <p className="text-sm sm:text-base text-gray-600 text-center mb-4 sm:mb-6 leading-relaxed">
                {notificationType === 'cancellation_request' ? (
                  modalAction === "approve"
                    ? "The guest will be allowed to cancel their booking. They will receive a cancellation confirmation email."
                    : "The guest's cancellation request will be denied. They will be notified immediately."
                ) : (
                  modalAction === "approve"
                    ? "The guest will receive a confirmation email with all booking details and payment information."
                    : "The guest will be notified immediately. This action cannot be undone."
                )}
              </p>

              <div className="flex gap-2 sm:gap-3">
                <button
                  onClick={closeModal}
                  className="flex-1 px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-100 hover:bg-gray-200 rounded-xl text-gray-700 font-semibold transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmAction}
                  className={`flex-1 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-sm sm:text-base ${modalAction === "approve"
                    ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                    : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                    }`}
                >
                  Yes, {modalAction === "approve" ? "Approve" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const handleApprove = async (bookingId, notifId) => {
  try {
    // Update booking status
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, { status: "confirmed", approvedAt: serverTimestamp() });

    // Get booking data
    const bookingSnap = await getDoc(bookingRef);
    const bookingData = bookingSnap.data();

    // Send email receipt to guest
    await fetch(getEmailEndpoint('receipt'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: bookingData.guestEmail,
        fullName: bookingData.guestName,
        listingTitle: bookingData.listingTitle,
        checkIn: bookingData.checkIn?.toDate()?.toLocaleDateString() || "N/A",
        checkOut: bookingData.checkOut?.toDate()?.toLocaleDateString() || "N/A",
        guests: bookingData.guests?.total || 1,
        price: bookingData.finalPrice,
      }),
    });

    // Create notification for guest
    const guestNotifData = {
      userId: bookingData.userId,
      type: "booking_approved",
      title: "Booking Approved! 🎉",
      message: `Your booking for "${bookingData.listingTitle}" has been approved by the host. Check your email for the confirmation receipt.`,
      listingTitle: bookingData.listingTitle,
      bookingId: bookingId,
      read: false,
      timestamp: serverTimestamp(),
    };
    console.log("Creating guest notification:", guestNotifData);
    await addDoc(collection(db, "guestNotifications"), guestNotifData);

    // Add transaction record for guest, including guests field
    const transactionData = {
      userId: bookingData.userId,
      bookingId: bookingId,
      amount: bookingData.finalPrice,
      listingTitle: bookingData.listingTitle,
      checkIn: bookingData.checkIn,
      checkOut: bookingData.checkOut,
      guests: bookingData.guests || bookingData.total || 1,
      createdAt: serverTimestamp(),
      type: "booking",
      status: "confirmed",
    };
    await addDoc(collection(db, "transactions"), transactionData);

    // Mark notification as processed
    console.log("🔒 Marking notification as processed:", notifId);
    await updateDoc(doc(db, "notifications", notifId), { 
      processed: true,
      status: 'approved'
    });
    console.log("✅ Notification marked as processed");
    
    console.log("✅ Booking approved, email sent, guest notified, and transaction recorded");
  } catch (err) {
    console.error("❌ Failed to approve booking:", err);
    throw err;
  }
};

const handleReject = async (bookingId, notifId) => {
  try {
    // Update booking status
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, { status: "rejected", rejectedAt: serverTimestamp() });

    // Get booking data
    const bookingSnap = await getDoc(bookingRef);
    const bookingData = bookingSnap.data();

    // Create notification for guest
    const guestNotifData = {
      userId: bookingData.userId,
      type: "booking_cancelled",
      title: "Booking Rejected",
      message: `Unfortunately, your booking request for "${bookingData.listingTitle}" has been declined by the host.`,
      listingTitle: bookingData.listingTitle,
      bookingId: bookingId,
      read: false,
      timestamp: serverTimestamp(),
    };
    console.log("Creating guest cancellation notification:", guestNotifData);
    await addDoc(collection(db, "guestNotifications"), guestNotifData);

    // Mark notification as processed
    console.log("🔒 Marking notification as processed:", notifId);
    await updateDoc(doc(db, "notifications", notifId), { 
      processed: true,
      status: 'rejected'
    });
    console.log("✅ Notification marked as processed");
    
    console.log("✅ Booking rejected and guest notified");
  } catch (err) {
    console.error("❌ Failed to reject booking:", err);
    throw err;
  }
};

const handleApproveCancellation = async (bookingId, notifId) => {
  try {
    // Get booking data before deleting
    const bookingRef = doc(db, "bookings", bookingId);
    const bookingSnap = await getDoc(bookingRef);
    const bookingData = bookingSnap.data();

    // Send cancellation receipt to guest
    await fetch(getEmailEndpoint('cancellation'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: bookingData.guestEmail,
        fullName: bookingData.guestName,
        listingTitle: bookingData.listingTitle,
        checkIn: bookingData.checkIn?.toDate?.() ? bookingData.checkIn.toDate().toLocaleDateString() : "N/A",
        checkOut: bookingData.checkOut?.toDate?.() ? bookingData.checkOut.toDate().toLocaleDateString() : "N/A",
        guests: bookingData.guests?.total || bookingData.guests || bookingData.total || 1,
        price: bookingData.finalPrice,
      }),
    });

    // Delete the booking immediately
    await deleteDoc(bookingRef);

    // Create notification for guest
    const guestNotifData = {
      userId: bookingData.userId,
      type: "cancellation_approved",
      title: "Cancellation Approved ✅",
      message: `The host has approved your cancellation request for "${bookingData.listingTitle}". Your booking has been removed.`,
      listingTitle: bookingData.listingTitle,
      bookingId: bookingId,
      read: false,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, "guestNotifications"), guestNotifData);

    // Mark notification as processed
    await updateDoc(doc(db, "notifications", notifId), { 
      processed: true,
      status: 'approved'
    });
    
    console.log("✅ Cancellation approved, booking deleted, guest notified, and cancellation receipt sent");
  } catch (err) {
    console.error("❌ Failed to approve cancellation:", err);
    throw err;
  }
};

const handleRejectCancellation = async (bookingId, notifId) => {
  try {
    // Update booking to reject cancellation
    const bookingRef = doc(db, "bookings", bookingId);
    await updateDoc(bookingRef, { 
      cancellationStatus: "rejected", 
      cancellationRejectedAt: serverTimestamp() 
    });

    // Get booking data
    const bookingSnap = await getDoc(bookingRef);
    const bookingData = bookingSnap.data();

    // Create notification for guest
    const guestNotifData = {
      userId: bookingData.userId,
      type: "cancellation_rejected",
      title: "Cancellation Request Denied ❌",
      message: `The host has declined your cancellation request for "${bookingData.listingTitle}".`,
      listingTitle: bookingData.listingTitle,
      bookingId: bookingId,
      read: false,
      timestamp: serverTimestamp(),
    };
    await addDoc(collection(db, "guestNotifications"), guestNotifData);

    // Mark notification as processed
    await updateDoc(doc(db, "notifications", notifId), { 
      processed: true,
      status: 'rejected'
    });
    
    console.log("✅ Cancellation rejected and guest notified");
  } catch (err) {
    console.error("❌ Failed to reject cancellation:", err);
    throw err;
  }
};

export default HostNotifications;

import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png"; // ✅ Add this image
import { Home, Clipboard, User, Gift, MessageSquare, Calendar, Ticket, ChevronLeft, ChevronRight, X, DollarSign, Info, Bell, LogOut } from "lucide-react";

const Calendars = () => {
  const [host, setHost] = useState(null); // ✅ Host data
  const [dropdownOpen, setDropdownOpen] = useState(false); // ✅ Added
  const dropdownRef = useRef(null); // ✅ Added
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);
  // Calendar specific state
  const [bookings, setBookings] = useState([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [dateBookings, setDateBookings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  // Blocked date feature removed per request

  // Helper: start of month
  const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);

  const prevMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const formatDateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  // Expand booking into all occupied nights (simple inclusive range on dates available)
  const expandBookingDates = (b) => {
    const days = [];
    if (!b.checkIn || !b.checkOut) return days;
    const start = b.checkIn.seconds ? new Date(b.checkIn.seconds * 1000) : new Date(b.checkIn);
    const end = b.checkOut.seconds ? new Date(b.checkOut.seconds * 1000) : new Date(b.checkOut);
    let cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    while (cursor <= end) {
      days.push(formatDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return days;
  };

  const bookingsByDate = (() => {
    const map = {};
    bookings.forEach(b => {
      expandBookingDates(b).forEach(day => {
        if (!map[day]) map[day] = [];
        map[day].push(b);
      });
    });
    return map;
  })();

  // Daily metrics: check-ins, check-outs, and revenue recognized on check-in day
  const { dailyCheckins, dailyCheckouts, dailyRevenue, maxDailyRevenue } = (() => {
    const ci = {};
    const co = {};
    const rev = {};
    bookings.forEach(b => {
      const checkIn = b.checkIn?.seconds ? new Date(b.checkIn.seconds * 1000) : b.checkIn ? new Date(b.checkIn) : null;
      const checkOut = b.checkOut?.seconds ? new Date(b.checkOut.seconds * 1000) : b.checkOut ? new Date(b.checkOut) : null;
      const amount = (b.finalPrice ?? b.price) || 0;
      if (checkIn) {
        const key = `${checkIn.getFullYear()}-${String(checkIn.getMonth() + 1).padStart(2, '0')}-${String(checkIn.getDate()).padStart(2, '0')}`;
        ci[key] = (ci[key] || 0) + 1;
        rev[key] = (rev[key] || 0) + amount;
      }
      if (checkOut) {
        const key = `${checkOut.getFullYear()}-${String(checkOut.getMonth() + 1).padStart(2, '0')}-${String(checkOut.getDate()).padStart(2, '0')}`;
        co[key] = (co[key] || 0) + 1;
      }
    });
    const maxRev = Object.values(rev).length ? Math.max(...Object.values(rev)) : 0;
    return { dailyCheckins: ci, dailyCheckouts: co, dailyRevenue: rev, maxDailyRevenue: maxRev };
  })();

  // Calculate withdrawn amount from host document (default 0)
  const withdrawn = host?.withdrawn || 0;
  // Calculate month revenue as sum of bookings for the month minus withdrawn (capped at 0)
  const monthRevenueRaw = bookings.reduce((sum, b) => {
    // count booking only if it intersects current month
    const checkIn = b.checkIn?.seconds ? new Date(b.checkIn.seconds * 1000) : b.checkIn ? new Date(b.checkIn) : null;
    if (!checkIn) return sum;
    if (checkIn.getMonth() === currentMonth.getMonth() && checkIn.getFullYear() === currentMonth.getFullYear()) {
      const amount = (b.finalPrice ?? b.price) || 0;
      return sum + amount;
    }
    return sum;
  }, 0);
  const monthRevenue = Math.max(Math.min(monthRevenueRaw, Math.max(monthRevenueRaw - withdrawn, 0)), 0);

  // 🔥 Track logged-in user and fetch their Firestore data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "hosts", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setHost(data);
          // fetch bookings for host
          fetchHostBookings(user.uid);
        } else {
          console.log("No host data found for this user");
        }
      } else {
        setHost(null);
        setBookings([]);
      }
    });

    return () => unsubscribe();
  }, []);

  const fetchHostBookings = async (hostId) => {
    setLoadingBookings(true);
    try {
      const q = query(collection(db, 'bookings'), where('hostId', '==', hostId));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setBookings(list);
    } catch (e) {
      console.error('Failed to fetch bookings', e);
    } finally {
      setLoadingBookings(false);
    }
  };

  const openDateModal = (dayDate) => {
    const key = formatDateKey(dayDate);
    setSelectedDate(dayDate);
    setDateBookings(bookingsByDate[key] || []);
    setShowModal(true);
  };

  // Block/unblock handlers removed

  const daysInGrid = (() => {
    const days = [];
    const firstWeekday = startOfMonth.getDay(); // 0 Sunday
    // leading blanks
    for (let i = 0; i < firstWeekday; i++) {
      days.push(null);
    }
    for (let d = 1; d <= endOfMonth.getDate(); d++) {
      days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), d));
    }
    return days;
  })();

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

  // 🎨 Helper for sidebar navigation
  const getNavItem = (path, label, Icon) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => handleNavigation(path)}
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${isActive
          ? "bg-[#FF5A1F] text-white"
          : "text-[#23364A] hover:bg-gray-100"
          }`}
      >
        {Icon && <Icon className="w-5 h-5 text-current" />}
        <span className={`${isActive ? "text-white" : "text-[#23364A]"}`}>
          {label}
        </span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans">
      {/* Sidebar */}
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

      {/* ===== Main Content ===== */}
      <main className="flex-1 px-4 sm:px-8 md:px-16 py-10 md:ml-[260px]">        
        <h2 className="text-2xl sm:text-[32px] font-bold mb-2 flex items-center gap-2">
          <span className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
            <Calendar className="w-7 h-7" />
          </span>
          Host Calendar
        </h2>
        <p className="text-[#5E6282] text-base sm:text-lg mb-8">Your unified view of bookings, revenue, and occupancy. Tap any date to view details. Use the arrows to navigate months.</p>

        {/* Month Navigation + Summary */}
        <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6 mb-10">
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm active:scale-95 transition"><ChevronLeft className="w-5 h-5" /></button>
            <div className="text-xl font-bold tracking-tight flex items-center gap-2">
              <span className="bg-gradient-to-r from-orange-500 to-indigo-600 bg-clip-text text-transparent">
                {startOfMonth.toLocaleString('default', { month: 'long' })}
              </span>
              <span className="text-gray-500 font-medium">{startOfMonth.getFullYear()}</span>
            </div>
            <button onClick={nextMonth} className="p-2 rounded-xl border bg-white hover:bg-gray-50 shadow-sm active:scale-95 transition"><ChevronRight className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 sm:flex sm:flex-row items-stretch gap-4 w-full sm:w-auto">
            <div className="flex items-center gap-3 text-sm bg-white border rounded-2xl px-5 py-3 shadow-sm hover:shadow-md transition group">
              <div className="p-2 rounded-xl bg-green-100 text-green-700 group-hover:scale-110 transition"><DollarSign className="w-4 h-4" /></div>
              <div className="flex flex-col">
                <span className="font-medium text-gray-600">Revenue</span>
                <span className="font-bold text-lg">₱{monthRevenue.toLocaleString()}</span>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm bg-white border rounded-2xl px-5 py-3 shadow-sm hover:shadow-md transition group">
              <div className="p-2 rounded-xl bg-indigo-100 text-indigo-700 group-hover:scale-110 transition"><Info className="w-4 h-4" /></div>
              <div className="flex flex-col">
                <span className="font-medium text-gray-600">Bookings</span>
                <span className="font-bold text-lg">{bookings.filter(b => {
                  const ci = b.checkIn?.seconds ? new Date(b.checkIn.seconds * 1000) : b.checkIn ? new Date(b.checkIn) : null;
                  return ci && ci.getMonth() === currentMonth.getMonth() && ci.getFullYear() === currentMonth.getFullYear();
                }).length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 text-[10px] sm:text-xs">
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-orange-400" />
            <span className="font-medium text-gray-700">Booked</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-green-400" />
            <span className="font-medium text-gray-700">Check-in</span>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 bg-white border rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 shadow-sm">
            <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded bg-gray-100 border border-gray-300" />
            <span className="font-medium text-gray-700">Available</span>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-lg overflow-hidden">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => (
              <div key={d} className="text-center py-2 sm:py-3 text-[10px] sm:text-sm font-semibold border-r border-orange-400 last:border-r-0">
                <span className="hidden md:inline">{d}</span>
                <span className="hidden sm:inline md:hidden">{d.slice(0, 3)}</span>
                <span className="sm:hidden">{d.slice(0, 1)}</span>
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 divide-x divide-y divide-gray-200">
            {daysInGrid.map((day, i) => {
              if (day === null) return (
                <div key={i} className="bg-gray-50/50 min-h-[70px] sm:min-h-[90px] md:min-h-[110px]" />
              );

              const key = formatDateKey(day);
              const dayBookings = bookingsByDate[key] || [];
              const hasBookings = dayBookings.length > 0;
              const startsToday = dayBookings.some(b => {
                const ci = b.checkIn?.seconds ? new Date(b.checkIn.seconds * 1000) : b.checkIn ? new Date(b.checkIn) : null;
                return ci && ci.getDate() === day.getDate() && ci.getMonth() === day.getMonth() && ci.getFullYear() === day.getFullYear();
              });
              const today = new Date();
              const isToday = today.getDate() === day.getDate() && today.getMonth() === day.getMonth() && today.getFullYear() === day.getFullYear();
              const weekend = [0, 6].includes(day.getDay());

              const dailyRev = dailyRevenue[key] || 0;
              const checkins = dailyCheckins[key] || 0;
              const checkouts = dailyCheckouts[key] || 0;

              // Determine cell background
              let bgClass = weekend ? 'bg-gray-50' : 'bg-white';
              if (hasBookings) bgClass = 'bg-orange-50';
              else if (startsToday) bgClass = 'bg-green-50';

              return (
                <div
                  key={key}
                  className={`${bgClass} min-h-[70px] sm:min-h-[90px] md:min-h-[110px] p-1 sm:p-2 cursor-pointer hover:bg-opacity-70 transition-colors relative group`}
                  onClick={() => openDateModal(day)}
                >
                  {/* Date Number */}
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    <div className={`
                      w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 flex items-center justify-center rounded-full text-[10px] sm:text-xs md:text-sm font-semibold
                      ${isToday ? 'bg-orange-500 text-white shadow-md' :
                        hasBookings ? 'bg-orange-200 text-orange-800' :
                          'text-gray-700'}
                    `}>
                      {day.getDate()}
                    </div>

                    {/* Status Badge - Hidden on mobile if there are check-in/out badges */}
                    {hasBookings && (checkins === 0 && checkouts === 0) && (
                      <span className="hidden sm:inline text-[8px] sm:text-[9px] font-bold uppercase px-1 sm:px-1.5 py-0.5 rounded bg-orange-400 text-white">
                        Booked
                      </span>
                    )}
                  </div>

                  {/* Check-in/out badges */}
                  {(checkins > 0 || checkouts > 0) && (
                    <div className="flex gap-0.5 sm:gap-1 mb-0.5 sm:mb-1 flex-wrap">
                      {checkins > 0 && (
                        <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold border border-green-300">
                          <span className="hidden sm:inline">↓ </span>{checkins}
                        </span>
                      )}
                      {checkouts > 0 && (
                        <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-semibold border border-blue-300">
                          <span className="hidden sm:inline">↑ </span>{checkouts}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Booking Info - Simplified on mobile */}
                  {hasBookings && (
                    <div className="space-y-0.5 sm:space-y-1">
                      {/* Show dots on mobile, text on larger screens */}
                      <div className="sm:hidden flex gap-0.5">
                        {dayBookings.slice(0, 3).map((b, idx) => (
                          <div key={b.id} className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                        ))}
                      </div>

                      {/* Show booking names on tablet and up */}
                      <div className="hidden sm:block">
                        {dayBookings.slice(0, 1).map(b => (
                          <div key={b.id} className="text-[9px] md:text-[10px] font-medium text-gray-700 truncate bg-white/60 px-1 md:px-1.5 py-0.5 rounded">
                            {b.listingTitle || 'Booking'}
                          </div>
                        ))}
                        {dayBookings.length > 1 && (
                          <div className="text-[9px] md:text-[10px] font-semibold text-orange-600">
                            +{dayBookings.length - 1} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Revenue indicator - Simplified on mobile */}
                  {dailyRev > 0 && (
                    <div className="absolute bottom-0.5 sm:bottom-1 right-0.5 sm:right-1 text-[8px] sm:text-[9px] font-bold text-green-600 bg-green-100 px-1 sm:px-1.5 py-0.5 rounded">
                      <span className="hidden sm:inline">₱</span>{Math.round(dailyRev / 1000)}k
                    </div>
                  )}

                  {/* Hover overlay with click hint */}
                  <div className="absolute inset-0 bg-orange-500 opacity-0 group-hover:opacity-10 transition-opacity pointer-events-none rounded" />

                  {/* Today ring */}
                  {isToday && (
                    <div className="absolute inset-0 ring-1 sm:ring-2 ring-inset ring-orange-500 rounded pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {loadingBookings && (
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 animate-pulse">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-200/60" />
            ))}
          </div>
        )}

        {/* Modal */}
        {showModal && selectedDate && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-2xl sm:rounded-3xl rounded-t-3xl shadow-2xl relative max-h-[90vh] sm:max-h-[85vh] flex flex-col">
              <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sm:py-5 rounded-t-3xl flex items-center justify-between">
                <div className="flex-1 pr-4">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="bg-orange-100 text-orange-700 px-2.5 py-1 rounded-lg text-xs sm:text-sm font-semibold">
                      {dateBookings.length} {dateBookings.length === 1 ? 'Booking' : 'Bookings'}
                    </span>
                    <h3 className="text-lg sm:text-2xl font-bold tracking-tight">
                      {selectedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </h3>
                  </div>
                  <p className="text-[10px] sm:text-xs text-gray-500">Bookings on this date</p>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition p-2 hover:bg-gray-100 rounded-full"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                <div className="space-y-3 sm:space-y-4">
                  {dateBookings.length === 0 ? (
                    <div className="text-sm text-gray-500 border border-dashed rounded-xl p-6 sm:p-8 text-center bg-gray-50">
                      <Calendar className="w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 text-gray-400" />
                      <p className="font-medium">No bookings for this date</p>
                      <p className="text-xs mt-1">This day is available for new bookings</p>
                    </div>
                  ) : dateBookings.map(b => {
                    const ci = b.checkIn?.seconds ? new Date(b.checkIn.seconds * 1000) : b.checkIn ? new Date(b.checkIn) : null;
                    const co = b.checkOut?.seconds ? new Date(b.checkOut.seconds * 1000) : b.checkOut ? new Date(b.checkOut) : null;
                    const amount = (b.finalPrice ?? b.price) || 0;
                    return (
                      <div key={b.id} className="border rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-white shadow-sm hover:shadow-md transition relative">
                        <div className="flex justify-between items-start mb-2 gap-2">
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="font-semibold text-sm sm:text-base truncate">{b.listingTitle || 'Booking'}</span>
                            <span className="text-[10px] sm:text-[11px] text-gray-500">ID: {b.id.slice(0, 8)}…</span>
                          </div>
                          <span className="text-xs sm:text-sm font-bold px-2 py-1 rounded-full bg-orange-500/10 text-orange-600 ring-1 ring-orange-300 whitespace-nowrap">
                            ₱{amount.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-[10px] sm:text-[11px] text-gray-600 flex flex-wrap gap-2 sm:gap-3">
                          <span className="flex items-center gap-1">
                            <span className="font-medium">In:</span> {ci ? ci.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="font-medium">Out:</span> {co ? co.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "—"}
                          </span>
                          {b.couponUsed && (
                            <span className="flex items-center gap-1 text-green-600 font-medium">
                              Coupon: {b.couponUsed.code}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 rounded-b-3xl">
                <div className="flex items-center justify-end">
                  <button
                    onClick={() => setShowModal(false)}
                    className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl border border-gray-300 text-sm font-medium bg-white hover:bg-gray-50 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default Calendars;

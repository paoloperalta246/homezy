import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase"; // ✅ Import your Firebase config
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png"; // ✅ Add this image
import { Home, Clipboard, User, Gift, MessageSquare, Calendar, Ticket, Users, CreditCard, XCircle } from "lucide-react";
import { Link } from "react-router-dom";

const Dashboard = () => {
  const [activeTab, setActiveTab] = useState("today");
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const normalizeDate = (date) => {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0); // normalize the booking date
    return d;
  };

  const todayBookings = bookings.filter(
    (b) =>
      normalizeDate(b.checkIn) <= today &&
      normalizeDate(b.checkOut) >= today
  );

  const upcomingBookings = bookings.filter(
    (b) => normalizeDate(b.checkIn) > today
  );

  const BookingCard = ({ booking }) => (
    <div className="bg-white rounded-2xl shadow-md hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 overflow-hidden w-full group">
      {/* Thumbnail */}
      <div className="relative h-64 w-full overflow-hidden">
        <img
          src={booking.listingImage || "/default-listing.png"}
          alt={booking.listingTitle}
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
      </div>

      {/* Info Section */}
      <div className="p-6">
        <h3 className="font-bold text-gray-800 text-xl mb-4 line-clamp-1">
          {booking.listingTitle}
        </h3>

        {/* Date Info */}
        <div className="space-y-3 mb-5">
          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0 text-orange-500" />
            <div className="flex-1">
              <p className="font-semibold text-gray-700 mb-1">Check-in</p>
              <p>
                {booking.checkIn
                  ? new Date(
                    booking.checkIn.seconds
                      ? booking.checkIn.seconds * 1000
                      : booking.checkIn
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                  : "Not specified"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 text-sm text-gray-600">
            <Calendar className="w-5 h-5 mt-0.5 flex-shrink-0 text-orange-500" />
            <div className="flex-1">
              <p className="font-semibold text-gray-700 mb-1">Check-out</p>
              <p>
                {booking.checkOut
                  ? new Date(
                    booking.checkOut.seconds
                      ? booking.checkOut.seconds * 1000
                      : booking.checkOut
                  ).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                  : "Not specified"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-gray-600">
            <Users className="w-5 h-5 flex-shrink-0 text-orange-500" />
            <span className="font-semibold text-gray-700">Guests:</span>
            <span>
              {booking.guests.adults +
                booking.guests.children +
                booking.guests.infants +
                booking.guests.pets}
            </span>
          </div>
        </div>

        {/* Price */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-500">Total</span>
          </div>
          <p className="font-bold text-gray-800 text-2xl">
            ₱{booking.price.toLocaleString()}.00
          </p>
        </div>
      </div>
    </div>
  );

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
      } else {
        setHost(null);
      }
    });

    return () => unsubscribe();
  }, []);

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

  useEffect(() => {
    const fetchBookings = async () => {
      if (!auth.currentUser) return;
      setLoading(true);

      try {
        const bookingsQuery = query(
          collection(db, "bookings"),
          where("hostId", "==", auth.currentUser.uid)
        );

        const snapshot = await getDocs(bookingsQuery); // ✅ use getDocs
        const fetchedBookings = snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            checkIn: data.checkIn?.toDate ? data.checkIn.toDate() : data.checkIn ? new Date(data.checkIn) : null,
            checkOut: data.checkOut?.toDate ? data.checkOut.toDate() : data.checkOut ? new Date(data.checkOut) : null,
          };
        });

        setBookings(fetchedBookings);
      } catch (err) {
        console.error("Failed to fetch bookings:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, []);

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
            <div className="flex items-center gap-2 px-6 py-6 pl-10 pt-10">
              <img
                src={homezyLogo}
                alt="Homezy Logo"
                className="w-11 h-11 object-contain"
              />
              <h1 className="text-[30px] font-bold text-[#23364A]">Homezy</h1>
            </div>
            <nav className="flex flex-col mt-4">
              {getNavItem("/dashboard", "Dashboard", Home)}
              {getNavItem("/listings", "My Listings", Clipboard)}
              {getNavItem("/host-messages", "Messages", MessageSquare)}
              {getNavItem("/calendar", "Calendar", Calendar)}
              {getNavItem("/points-rewards", "Points & Rewards", Gift)}
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
              <img
                src={host?.photoURL || defaultProfile}
                alt="profile"
                className="w-6 h-6 rounded-full object-cover"
              />
              <span>{host?.firstName || "Host"}</span>
            </button>

            {host && dropdownOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden z-50">
                <div className="p-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <img
                      src={host.photoURL || defaultProfile}
                      alt="profile"
                      className="w-10 h-10 rounded-full object-cover border border-gray-200"
                    />
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
              className="bg-[#B50000] text-white font-medium py-2 w-full rounded-md hover:opacity-90"
            >
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
      <main className="flex-1 px-4 sm:px-8 md:px-16 py-6 md:py-10 md:ml-[260px]">
        {/* Tab Switcher */}
        <div className="flex justify-center mb-6 overflow-x-auto">
          <div className="flex gap-0 flex-nowrap">
            <button
              onClick={() => setActiveTab("today")}
              className={`px-4 sm:px-6 py-2 rounded-l-md font-medium transition ${activeTab === "today" ? "bg-[#FF5A1F] text-white" : "bg-gray-300 text-[#23364A]"
                }`}
            >
              Today
            </button>
            <button
              onClick={() => setActiveTab("upcoming")}
              className={`px-4 sm:px-6 py-2 rounded-r-md font-medium transition ${activeTab === "upcoming" ? "bg-[#FF5A1F] text-white" : "bg-gray-300 text-[#23364A]"
                }`}
            >
              Upcoming
            </button>
          </div>
        </div>

        {loading ? (
          <p className="text-center text-gray-500 py-16 text-lg">Loading bookings...</p>
        ) : activeTab === "today" ? (
          <div className="mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 w-full gap-4">
              {/* Left side: Heading + description + reserved space */}
              <div className="flex-1 min-w-0 flex flex-col">
                <h2 className="text-2xl sm:text-[28px] font-bold mb-1">Today's Bookings</h2>
                <p className="text-[#5E6282] text-base sm:text-lg">Check-ins and activities happening today</p>

                {/* Reserve space for "Results for:" */}
                <div className="mt-2 mb-10 min-h-[32px]">
                  {searchTerm && (
                    <span className="text-[#FF5A1F] font-bold text-xl sm:text-2xl truncate block">
                      Results for: <span className="font-extrabold">{searchTerm}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Right side: Search bar */}
              <div className="flex flex-col sm:flex-row flex-shrink-0 items-start sm:items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search bookings..."
                  className="border border-gray-300 px-3 py-2 rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-[#FF5A1F] outline-none text-sm sm:text-base"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setSearchTerm(searchInput.trim()); }}
                />
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setSearchTerm(searchInput.trim())}
                    className="bg-[#FF5A1F] text-white px-3 py-2 rounded-lg font-medium hover:opacity-90 transition w-full sm:w-auto text-sm sm:text-base"
                  >
                    Search
                  </button>
                  {searchTerm && (
                    <button
                      onClick={() => { setSearchTerm(""); setSearchInput(""); }}
                      className="text-gray-500 hover:text-[#FF5A1F] px-2 py-2 rounded w-full sm:w-auto text-sm sm:text-base"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {todayBookings.length === 0 ? (
              <p className="text-gray-500">No bookings for today.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {todayBookings
                  .filter(b => !searchTerm || b.listingTitle.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((b) => <BookingCard key={b.id} booking={b} className="sm:min-h-[250px] lg:min-h-[280px]" />)}
              </div>
            )}
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-4 w-full gap-4">
              {/* Left side: Heading + description + reserved space */}
              <div className="flex-1 min-w-0 flex flex-col">
                <h2 className="text-2xl sm:text-[28px] font-bold mb-1">Upcoming Bookings</h2>
                <p className="text-[#5E6282] text-base sm:text-lg">All future reservations and scheduled stays</p>

                <div className="mt-2 min-h-[32px]">
                  {searchTerm && (
                    <span className="text-[#FF5A1F] font-bold text-xl sm:text-2xl truncate block">
                      Results for: <span className="font-extrabold">{searchTerm}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Right side: Search bar */}
              <div className="flex flex-col sm:flex-row flex-shrink-0 items-start sm:items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search bookings..."
                  className="border border-gray-300 px-3 py-2 rounded-lg w-full sm:w-64 focus:ring-2 focus:ring-[#FF5A1F] outline-none text-sm sm:text-base"
                  value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') setSearchTerm(searchInput.trim()); }}
                />
                <div className="flex gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => setSearchTerm(searchInput.trim())}
                    className="bg-[#FF5A1F] text-white px-3 py-2 rounded-lg font-medium hover:opacity-90 transition w-full sm:w-auto text-sm sm:text-base"
                  >
                    Search
                  </button>
                  {searchTerm && (
                    <button
                      onClick={() => { setSearchTerm(""); setSearchInput(""); }}
                      className="text-gray-500 hover:text-[#FF5A1F] px-2 py-2 rounded w-full sm:w-auto text-sm sm:text-base"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>

            {upcomingBookings.length === 0 ? (
              <p className="text-gray-500">No upcoming bookings.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {upcomingBookings
                  .filter(b => !searchTerm || b.listingTitle.toLowerCase().includes(searchTerm.toLowerCase()))
                  .map((b) => <BookingCard key={b.id} booking={b} className="sm:min-h-[250px] lg:min-h-[280px]" />)}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default Dashboard;

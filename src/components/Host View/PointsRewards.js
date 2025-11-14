import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase"; // ✅ Import your Firebase config
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png"; // ✅ Add this image
import { Home, Clipboard, User, Gift, MessageSquare, Calendar, Ticket, Award, TrendingUp, History, Sparkles, DollarSign, ChevronLeft, ChevronRight, Info, X, Bell, LogOut } from "lucide-react";
import { getUserPoints, addPoints, getTierByPoints, getNextTier, TIERS } from '../../utils/points';
import { Link } from "react-router-dom";

const PointsRewards = () => {
    const [activeTab, setActiveTab] = useState("overview");
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [pointsState, setPointsState] = useState({ total: 0, tier: 'bronze' });
    const [transactions, setTransactions] = useState([]);
    const [txLoading, setTxLoading] = useState(false);
    const [host, setHost] = useState(null); // ✅ Host data
    const [dropdownOpen, setDropdownOpen] = useState(false); // ✅ Added
    const dropdownRef = useRef(null); // ✅ Added
    const [mobileOpen, setMobileOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1); // ✅ Pagination
    const [itemsPerPage] = useState(5); // ✅ Show 5 transactions per page
    const [showTiersModal, setShowTiersModal] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const currentPath = location.pathname;
    // Tier visuals
    const tierObj = getTierByPoints(pointsState.total);
    const nextTier = getNextTier(pointsState.total);
    const progressPct = nextTier ? Math.min(100, ((pointsState.total - tierObj.min) / (nextTier.min - tierObj.min)) * 100) : 100;

    // Pagination calculations
    const indexOfLastItem = currentPage * itemsPerPage;
    const indexOfFirstItem = indexOfLastItem - itemsPerPage;
    const currentTransactions = transactions.slice(indexOfFirstItem, indexOfLastItem);
    const totalPages = Math.ceil(transactions.length / itemsPerPage);

    const BookingCard = ({ booking }) => (
        <div className="bg-white rounded-3xl shadow-lg hover:shadow-2xl hover:-translate-y-2 transition-transform duration-300 overflow-hidden relative w-full max-w-xs min-w-0">
            <div className="relative h-48 w-full">
                <img
                    src={booking.listingImage || "/default-listing.png"}
                    alt={booking.listingTitle}
                    className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 w-full h-16 bg-gradient-to-t from-black/40 to-transparent"></div>
            </div>
            <div className="p-5">
                <h3 className="font-bold text-gray-800 text-lg mb-1">
                    {booking.listingTitle}
                </h3>
                <p className="text-sm text-gray-500 mb-3 leading-relaxed">
                    <span className="font-semibold">Check-in:</span>{" "}
                    {new Date(booking.checkIn).toLocaleDateString()} <br />
                    <span className="font-semibold">Check-out:</span>{" "}
                    {new Date(booking.checkOut).toLocaleDateString()} <br />
                    <span className="font-semibold">Guests:</span>{" "}
                    {booking.guests.adults +
                        booking.guests.children +
                        booking.guests.infants +
                        booking.guests.pets}
                </p>
                <p className="font-bold text-gray-800 text-lg">
                    ₱{booking.price.toLocaleString()}
                </p>
            </div>
        </div>
    );

    // 🔥 Track logged-in user and fetch their Firestore data
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // host profile
                try {
                    const docRef = doc(db, 'hosts', user.uid);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) setHost(docSnap.data()); else setHost(null);
                } catch (e) { console.warn('Host fetch failed:', e.message); }
                // points state
                try {
                    const pt = await getUserPoints(user.uid);
                    setPointsState(pt);
                } catch (e) { console.warn('Points fetch failed:', e.message); }
                // transactions
                fetchTransactions(user.uid);
            } else {
                setHost(null);
            }
        });
        return () => unsubscribe();
    }, []);

    const fetchTransactions = async (userId) => {
        setTxLoading(true);
        try {
            const q = query(collection(db, 'pointTransactions'), where('userId', '==', userId));
            const snap = await getDocs(q);
            const tx = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt?.seconds - a.createdAt?.seconds);
            setTransactions(tx);
        } catch (e) {
            console.warn('Transactions fetch failed:', e.message);
        } finally {
            setTxLoading(false);
        }
    };

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
                const bookingsQuery = query(collection(db, 'bookings'), where('hostId', '==', auth.currentUser.uid));
                const snapshot = await getDocs(bookingsQuery);
                const fetchedBookings = snapshot.docs.map(docSnap => {
                    const data = docSnap.data();
                    return {
                        id: docSnap.id,
                        ...data,
                        checkIn: data.checkIn?.toDate ? data.checkIn.toDate() : data.checkIn ? new Date(data.checkIn) : null,
                        checkOut: data.checkOut?.toDate ? data.checkOut.toDate() : data.checkOut ? new Date(data.checkOut) : null,
                    };
                });
                setBookings(fetchedBookings);
            } catch (e) { console.error('Failed to fetch bookings:', e); } finally { setLoading(false); }
        };
        fetchBookings();
    }, []);

    const awardManual = async () => {
        if (!auth.currentUser) return;
        try {
            await addPoints(auth.currentUser.uid, 25, 'manual', { note: 'Test award' });
            const updated = await getUserPoints(auth.currentUser.uid);
            setPointsState(updated);
            fetchTransactions(auth.currentUser.uid);
        } catch (e) { console.error(e); }
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
                        <div className="flex items-center gap-2 px-6 py-6 pl-10 pt-10">
                            <img
                                src={homezyLogo}
                                alt="Homezy Logo"
                                className="w-11 h-11 object-contain"
                            />
                            <h1 className="text-[30px] font-bold text-[#23364A]">Homezy</h1>
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
            <main className="flex-1 px-4 sm:px-8 md:px-16 py-10 md:ml-[260px] max-w-full overflow-x-hidden">
                <div className="mb-8">
                    <h2 className="text-2xl sm:text-[32px] font-bold mb-2 flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                            <Award className="w-7 h-7" />
                        </span>
                        Points & Rewards
                    </h2>
                    <p className="text-[#5E6282] text-base sm:text-lg mb-8 max-w-2xl">Earn points automatically from bookings and reviews, climb tiers, and redeem exclusive benefits.</p>
                </div>

                {/* Overview Card */}
                <section className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm mb-10">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                        <div>
                            <h3 className="text-xl font-semibold mb-1 flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-yellow-500" />
                                Current Points
                            </h3>
                            <p className="text-4xl font-extrabold tracking-tight text-[#23364A]">{pointsState.total.toLocaleString()}</p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-sm font-medium inline-flex items-center gap-1" style={{ color: tierObj.color }}>
                                    Tier: {tierObj.name}
                                </p>
                                <button
                                    onClick={() => setShowTiersModal(true)}
                                    className="text-xs text-orange-500 hover:text-orange-600 underline flex items-center gap-1"
                                >
                                    <Info className="w-3 h-3" />
                                    View All Tiers
                                </button>
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-medium mb-1 flex items-center gap-1"><TrendingUp className="w-4 h-4 text-orange-500" />Progress to {nextTier ? nextTier.name : 'Max Tier'}</p>
                            <div className="h-4 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full transition-all duration-500" style={{ width: progressPct + '%', background: 'linear-gradient(90deg,#FF7A1F,#FF5A1F)' }} />
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                {nextTier ? `${(pointsState.total - tierObj.min)} / ${(nextTier.min - tierObj.min)} points in current tier` : 'You have reached the highest tier!'}
                            </p>
                        </div>
                    </div>
                </section>

                {/* How to Earn Points */}
                <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-3xl p-6 sm:p-8 mb-10">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-blue-600" />
                        How to Earn Points
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100">
                            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                                <Clipboard className="w-6 h-6 text-blue-600" />
                            </div>
                            <h4 className="font-semibold text-gray-800 mb-2">Complete Bookings</h4>
                            <p className="text-sm text-gray-600">Earn points when guests complete their stay at your property</p>
                            <p className="text-xs text-blue-600 font-semibold mt-2">+10 points per booking</p>
                        </div>
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                                <Award className="w-6 h-6 text-green-600" />
                            </div>
                            <h4 className="font-semibold text-gray-800 mb-2">Receive Reviews</h4>
                            <p className="text-sm text-gray-600">Get rewarded when guests leave positive reviews</p>
                            <p className="text-xs text-green-600 font-semibold mt-2">+5 points per review</p>
                        </div>
                        <div className="bg-white rounded-xl p-5 shadow-sm border border-blue-100">
                            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                                <Gift className="w-6 h-6 text-purple-600" />
                            </div>
                            <h4 className="font-semibold text-gray-800 mb-2">Tier Multipliers</h4>
                            <p className="text-sm text-gray-600">Higher tiers earn more points per action</p>
                            <p className="text-xs text-purple-600 font-semibold mt-2">Up to {TIERS[TIERS.length - 1].multiplier}x bonus</p>
                        </div>
                    </div>
                </section>

                {/* Use Points for Service Fees */}
                <section className="bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-sm mb-10">
                    <h3 className="text-xl font-semibold mb-2 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-orange-500" />
                        Pay Service Fees with Points
                    </h3>
                    <p className="text-sm text-gray-600 mb-6">Use your earned points to pay admin service fees on your bookings. Each point is worth ₱1.</p>

                    <div className="bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-200 rounded-2xl p-6">
                        <div className="flex items-start gap-4 mb-4">
                            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Sparkles className="w-8 h-8 text-orange-600" />
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg font-bold text-gray-800 mb-2">Available Points Balance</h4>
                                <p className="text-3xl font-extrabold text-orange-600 mb-1">{pointsState.total.toLocaleString()} points</p>
                                <p className="text-sm text-gray-600">= ₱{pointsState.total.toLocaleString()} value for service fees</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-5 border border-orange-200">
                            <h5 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                                <Info className="w-4 h-4 text-orange-500" />
                                How It Works
                            </h5>
                            <ul className="space-y-2 text-sm text-gray-700">
                                <li className="flex items-start gap-2">
                                    <span className="text-orange-500 font-bold mt-0.5">1.</span>
                                    <span>When you receive a booking, admin service fees will be applied</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-orange-500 font-bold mt-0.5">2.</span>
                                    <span>You can choose to pay these fees using your points balance</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-orange-500 font-bold mt-0.5">3.</span>
                                    <span>Points will be automatically deducted from your balance</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <span className="text-orange-500 font-bold mt-0.5">4.</span>
                                    <span>You save money while the platform earns through service fees</span>
                                </li>
                            </ul>
                        </div>

                        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <p className="text-xs text-blue-800">
                                <strong>Note:</strong> Points can only be used for admin service fee payments. To create discount coupons for your guests, visit the Coupons page.
                            </p>
                        </div>
                    </div>
                </section>

                {/* Create Coupons CTA */}
                <section className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-3xl p-8 shadow-lg mb-10 text-white">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex-1">
                            <h3 className="text-2xl font-bold mb-2 flex items-center gap-2">
                                <Ticket className="w-7 h-7" />
                                Want to Create Discount Coupons?
                            </h3>
                            <p className="text-purple-100">
                                Create custom discount coupons for your guests to increase bookings. Coupons don't require points - create them anytime!
                            </p>
                        </div>
                        <button
                            onClick={() => navigate('/coupons')}
                            className="px-8 py-4 bg-white text-purple-600 font-bold rounded-xl hover:bg-purple-50 transition shadow-lg flex items-center gap-2 whitespace-nowrap"
                        >
                            <Ticket className="w-5 h-5" />
                            Go to Coupons
                        </button>
                    </div>
                </section>

                {/* Transactions */}
                <section className="mb-10">
                    <h3 className="text-xl font-semibold mb-4 flex items-center gap-2"><History className="w-5 h-5 text-orange-500" />Points Activity</h3>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-sm">
                        {txLoading ? (
                            <p className="text-sm text-gray-500">Loading transactions…</p>
                        ) : transactions.length === 0 ? (
                            <p className="text-sm text-gray-500">No point activity yet.</p>
                        ) : (
                            <>
                                <div className="space-y-3">
                                    {currentTransactions.map(t => {
                                        // Format source for better readability
                                        const formatSource = (source) => {
                                            const sourceMap = {
                                                'booking': 'Booking Completed',
                                                'review_received': 'Review Received',
                                                'review_deleted': 'Review Removed',
                                                'service_fee_payment': 'Service Fee Payment',
                                                'manual': 'Manual Award'
                                            };
                                            return sourceMap[source] || source;
                                        };

                                        // Get additional info from metadata if available
                                        const getDescription = () => {
                                            if (t.source === 'review_received' && t.meta?.listingName) {
                                                return `${t.meta.rating}⭐ review on "${t.meta.listingName}"`;
                                            }
                                            if (t.source === 'review_deleted' && t.meta?.listingName) {
                                                return `Review removed from "${t.meta.listingName}"`;
                                            }
                                            if (t.source === 'booking' && t.meta?.listingName) {
                                                return `"${t.meta.listingName}"`;
                                            }
                                            if (t.source === 'service_fee_payment' && t.meta?.bookingId) {
                                                return `Booking ID: ${t.meta.bookingId.substring(0, 8)}...`;
                                            }
                                            if (t.source === 'manual' && t.meta?.note) {
                                                return t.meta.note;
                                            }
                                            return '';
                                        };

                                        return (
                                            <div key={t.id} className="flex items-center justify-between text-sm bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                                <div className="flex flex-col flex-1">
                                                    <span className="font-medium text-[#23364A]">{formatSource(t.source)}</span>
                                                    {getDescription() && (
                                                        <span className="text-xs text-gray-600 mt-0.5">{getDescription()}</span>
                                                    )}
                                                    <span className="text-xs text-gray-500 mt-1">{t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleString() : ''}</span>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className={`font-semibold ${t.amount >= 0 ? 'text-green-600' : 'text-red-500'}`}>{t.amount >= 0 ? '+' : ''}{t.amount}</div>
                                                    <div className="text-xs text-gray-500 min-w-[80px] text-right">Total: {t.totalAfter}</div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between border-t border-gray-200 pt-4 gap-3">
                                        <div className="text-xs sm:text-sm text-gray-600 text-center sm:text-left">
                                            Showing {indexOfFirstItem + 1}-{Math.min(indexOfLastItem, transactions.length)} of {transactions.length} transactions
                                        </div>
                                        <div className="flex flex-wrap items-center justify-center gap-2 w-full sm:w-auto">
                                            <button
                                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                                disabled={currentPage === 1}
                                                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${currentPage === 1
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-orange-500 text-white hover:bg-orange-600'
                                                    }`}
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                <span className="hidden xs:inline">Previous</span>
                                            </button>

                                            <div className="flex items-center gap-1 flex-wrap">
                                                {[...Array(totalPages)].map((_, idx) => {
                                                    const pageNum = idx + 1;
                                                    // Show first page, last page, current page, and pages around current
                                                    if (
                                                        pageNum === 1 ||
                                                        pageNum === totalPages ||
                                                        (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                                                    ) {
                                                        return (
                                                            <button
                                                                key={pageNum}
                                                                onClick={() => setCurrentPage(pageNum)}
                                                                className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg text-xs sm:text-sm font-medium transition ${currentPage === pageNum
                                                                        ? 'bg-orange-500 text-white'
                                                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                                    }`}
                                                            >
                                                                {pageNum}
                                                            </button>
                                                        );
                                                    } else if (
                                                        pageNum === currentPage - 2 ||
                                                        pageNum === currentPage + 2
                                                    ) {
                                                        return <span key={pageNum} className="text-gray-400">...</span>;
                                                    }
                                                    return null;
                                                })}
                                            </div>

                                            <button
                                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                                disabled={currentPage === totalPages}
                                                className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition ${currentPage === totalPages
                                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                                        : 'bg-orange-500 text-white hover:bg-orange-600'
                                                    }`}
                                            >
                                                <span className="hidden xs:inline">Next</span>
                                                <ChevronRight className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </section>

                {/* Tiers Information Modal */}
                {showTiersModal && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-3xl">
                                <h3 className="text-2xl font-bold text-[#23364A] flex items-center gap-2">
                                    <Award className="w-6 h-6 text-orange-500" />
                                    Membership Tiers
                                </h3>
                                <button
                                    onClick={() => setShowTiersModal(false)}
                                    className="p-2 hover:bg-gray-100 rounded-full transition"
                                >
                                    <X className="w-5 h-5 text-gray-600" />
                                </button>
                            </div>

                            <div className="p-6 space-y-4">
                                <p className="text-gray-600 mb-6">
                                    Earn points from bookings and reviews to unlock higher tiers with better rewards and multipliers!
                                </p>

                                {TIERS.map((tier, index) => {
                                    const isCurrentTier = tier.id === pointsState.tier;
                                    const nextTierInfo = TIERS[index + 1];

                                    return (
                                        <div
                                            key={tier.id}
                                            className={`border-2 rounded-2xl p-5 transition-all ${isCurrentTier
                                                    ? 'border-orange-500 bg-orange-50 shadow-lg'
                                                    : 'border-gray-200 bg-white hover:shadow-md'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md"
                                                        style={{ backgroundColor: tier.color }}
                                                    >
                                                        {tier.name.charAt(0)}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-xl font-bold" style={{ color: tier.color }}>
                                                            {tier.name}
                                                        </h4>
                                                        <p className="text-sm text-gray-600">
                                                            {tier.min === 0 ? 'Starting tier' : `${tier.min.toLocaleString()} points required`}
                                                        </p>
                                                    </div>
                                                </div>
                                                {isCurrentTier && (
                                                    <span className="px-3 py-1 bg-orange-500 text-white text-xs font-bold rounded-full">
                                                        YOUR TIER
                                                    </span>
                                                )}
                                            </div>

                                            <div className="space-y-2 mt-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <div className="w-2 h-2 rounded-full bg-green-500"></div>
                                                    <span className="text-gray-700">
                                                        <strong>{tier.multiplier}x</strong> Points Multiplier
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 text-sm">
                                                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                                    <span className="text-gray-700">
                                                        Access to {tier.id === 'bronze' ? 'basic' : tier.id === 'silver' ? 'standard' : tier.id === 'gold' ? 'premium' : 'exclusive'} rewards
                                                    </span>
                                                </div>
                                                {tier.id !== 'bronze' && (
                                                    <div className="flex items-center gap-2 text-sm">
                                                        <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                                                        <span className="text-gray-700">
                                                            {tier.id === 'platinum' ? 'Priority support & special perks' : 'Enhanced benefits'}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Progress bar to next tier */}
                                            {nextTierInfo && isCurrentTier && (
                                                <div className="mt-4 pt-4 border-t border-gray-200">
                                                    <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
                                                        <span>Progress to {nextTierInfo.name}</span>
                                                        <span className="font-semibold">
                                                            {Math.max(0, pointsState.total - tier.min)} / {nextTierInfo.min - tier.min} points
                                                        </span>
                                                    </div>
                                                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                                        <div
                                                            className="h-full transition-all duration-500"
                                                            style={{
                                                                width: `${Math.min(100, ((pointsState.total - tier.min) / (nextTierInfo.min - tier.min)) * 100)}%`,
                                                                backgroundColor: nextTierInfo.color
                                                            }}
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 rounded-b-3xl">
                                <button
                                    onClick={() => setShowTiersModal(false)}
                                    className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default PointsRewards;

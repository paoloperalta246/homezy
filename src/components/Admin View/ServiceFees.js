import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, orderBy, query, where } from "firebase/firestore";
import { getUserPoints } from '../../utils/points';
import { auth, db } from "../../firebase";
import homezyLogo from "../Host View/images/homezy-logo.png";
import { LayoutDashboard, Users, DollarSign, FileText, Shield, Settings, LogOut, User } from "lucide-react";

const ServiceFees = () => {
    const [admin, setAdmin] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [bookings, setBookings] = useState([]);
    const [hosts, setHosts] = useState([]);
    const [serviceFees, setServiceFees] = useState([]);
    const [hostPoints, setHostPoints] = useState({});
    // Payment history modal state
    const [historyHost, setHistoryHost] = useState(null); // host object
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyRows, setHistoryRows] = useState([]); // array of serviceFees for selected host

    // Derived: recent bookings (last 5, sorted by createdAt desc)
    const recentBookings = [...bookings]
        .sort((a, b) => {
            const dateA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
            const dateB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
            return dateB - dateA;
        })
        .slice(0, 5);

    // Total confirmed bookings (like Host Dashboard)
    const totalConfirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
    const [reviews, setReviews] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [hostCount, setHostCount] = useState(null);
    const [guestCount, setGuestCount] = useState(null);
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;
    // Fetch all bookings and reviews for dynamic sections
    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            try {
                // Fetch hosts
                const hostsSnap = await getDocs(query(collection(db, "hosts"), where("email", ">", "")));
                const hostsList = hostsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHosts(hostsList);

                // Fetch service fee payments
                const feesSnap = await getDocs(collection(db, "serviceFees"));
                const feesList = feesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setServiceFees(feesList);

                // Fetch points for each host
                const pointsObj = {};
                for (const h of hostsList) {
                    try {
                        const pt = await getUserPoints(h.id);
                        pointsObj[h.id] = pt.total;
                    } catch {
                        pointsObj[h.id] = 0;
                    }
                }
                setHostPoints(pointsObj);
            } catch (e) {
                console.error("Failed to fetch hosts or service fees", e);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, []);

    // Fetch admin data on mount
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Try to fetch from admin collection using UID as document ID
                const adminDocRef = doc(db, "admin", user.uid);
                const adminSnap = await getDoc(adminDocRef);

                if (adminSnap.exists()) {
                    setAdmin(adminSnap.data());
                } else {
                    console.log("No admin data found for this user");
                }
            }
        });

        return () => unsubscribe();
    }, []);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
        setDropdownOpen(false);
        navigate("/login");
    };

    const getNavItem = (path, label, Icon, disabled = false) => {
        const isActive = currentPath === path;
        return (
            <button
                onClick={() => !disabled && navigate(path)}
                disabled={disabled}
                className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${disabled
                    ? "text-gray-300 cursor-not-allowed"
                    : isActive
                        ? "bg-[#FF5A1F] text-white"
                        : "text-[#23364A] hover:bg-gray-100"
                    }`}
            >
                {Icon && <Icon className="w-5 h-5 text-current" />}
                <span className={`${isActive ? "text-white" : disabled ? "text-gray-300" : "text-[#23364A]"}`}>
                    {label}
                </span>
            </button>
        );
    };

    // Helper: Map listingId to booking image
    const listingImageMap = {};
    bookings.forEach(b => {
        if (b.listingId) listingImageMap[b.listingId] = b.listingImage;
    });

    return (
        <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans flex-col md:flex-row">
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
                className={`fixed top-0 left-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between w-[85vw] max-w-[260px] z-40 transition-transform duration-300 md:w-[260px] md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-[85vw] md:translate-x-0"}`}
                style={{ minWidth: 0 }}
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
                            <span className="mt-1 px-2 py-[2px] rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold shadow border border-white/70 align-middle tracking-wider" style={{ letterSpacing: '0.5px', maxWidth: '70px', whiteSpace: 'nowrap' }}>Admin</span>
                        </div>
                    </div>
                    <nav className="flex flex-col mt-4">
                        {getNavItem("/admin-dashboard", "Dashboard", LayoutDashboard)}
                        {/* <div className="border-t border-gray-300 my-4 mx-6"></div> */}
                        {getNavItem("/guests-hosts", "Guests & Hosts", Users)}
                        {getNavItem("/service-fees", "Service Fees", DollarSign)}
                        {getNavItem("/admin-compliance", "Compliance", Shield)}
                        {getNavItem("/admin-reports", "Reports", FileText)}
                        {getNavItem("/admin-settings", "Settings", Settings)}
                    </nav>
                </div>

                {/* Logout */}
                <div className="flex flex-col items-center gap-4 mb-6 px-4">
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

            {/* Main Content Header */}
            <main className="flex-1 px-2 sm:px-8 md:px-16 py-4 sm:py-8 md:py-10 pt-16 sm:pt-6 md:pt-10 md:ml-[260px] w-full max-w-full overflow-x-hidden overflow-y-auto">
                <div className="mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl md:text-[32px] font-bold mb-2 flex items-center gap-2">
                        <span className="p-1.5 sm:p-2 rounded-xl bg-orange-500/10 text-orange-600">
                            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                        </span>
                        Service Fees
                    </h2>
                    <p className="text-[#5E6282] text-sm sm:text-base md:text-lg mb-6 sm:mb-8">
                        View and manage the service fee payments made by hosts for their subscription plans.
                    </p>
                </div>

                {/* Service Fee Table */}
                <div className="overflow-x-visible bg-gradient-to-br from-orange-50 via-white to-orange-100 border border-orange-200 rounded-3xl mb-14 p-2 sm:p-6">
                    <h3 className="text-2xl font-extrabold text-orange-900 px-2 sm:px-0 pt-2 pb-1 flex items-center gap-2">
                        <DollarSign className="w-7 h-7 text-orange-500" />
                        Current Service Fees
                    </h3>
                    <p className="px-2 sm:px-0 pb-4 text-orange-700/80 text-sm">Overview of each host's current subscription and payment status.</p>
                    <div className="rounded-2xl overflow-hidden border border-orange-100">
                        {loadingData ? (
                            <p className="p-8 text-orange-400 text-center text-lg font-semibold">Loading service fees...</p>
                        ) : hosts.length === 0 ? (
                            <p className="p-8 text-orange-400 text-center text-lg font-semibold">No hosts found.</p>
                        ) : (
                            <>
                                {/* Desktop Table */}
                                <table className="w-full min-w-[900px] text-sm table-fixed hidden sm:table">
                                    <colgroup>
                                        <col style={{ width: '18%' }} />
                                        <col style={{ width: '18%' }} />
                                        <col style={{ width: '14%' }} />
                                        <col style={{ width: '12%' }} />
                                        <col style={{ width: '13%' }} />
                                        <col style={{ width: '13%' }} />
                                        <col style={{ width: '12%' }} />
                                    </colgroup>
                                    <thead className="bg-gradient-to-r from-orange-100 via-orange-50 to-white border-b-2 border-orange-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Host</th>
                                            <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Email</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Plan</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Fee (₱)</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Payment Date</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Expires On</th>
                                            <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-orange-50">
                                        {hosts.map((h, idx) => {
                                            // Find service fee payment for this host and their current plan
                                            const fee = serviceFees.find(f => f.hostId === h.id && f.plan === h.subscriptionPlan);
                                            return (
                                                <tr key={h.id} className={`hover:bg-orange-100/60 transition-all group ${idx % 2 === 0 ? 'bg-orange-50/40' : 'bg-white'}`}>
                                                    <td className="px-4 py-3 font-semibold text-orange-900 flex items-center gap-2">
                                                        {h.photoURL ? (
                                                            <img src={h.photoURL} alt={h.fullName} className="w-9 h-9 rounded-full object-cover border-2 border-orange-200 shadow" />
                                                        ) : (
                                                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-base border-2 border-orange-200 shadow">
                                                                {h.fullName ? h.fullName.charAt(0).toUpperCase() : "?"}
                                                            </div>
                                                        )}
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="font-bold text-orange-900 text-sm truncate">{h.fullName}</span>
                                                            <span className="text-xs text-orange-500 font-medium truncate">{h.email}</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-orange-800 text-sm truncate">{h.email}</td>
                                                    <td className="px-4 py-3 capitalize text-orange-700 font-semibold text-center">{h.subscriptionPlan}</td>
                                                    <td className="px-4 py-3 text-orange-900 font-bold text-center">{h.subscriptionPrice ? `₱${h.subscriptionPrice}` : '-'}</td>
                                                    <td className="px-4 py-3 text-center text-xs text-orange-700 font-medium">
                                                        {fee && fee.paymentDate && fee.paymentDate.seconds ? new Date(fee.paymentDate.seconds * 1000).toLocaleDateString() : '-'}
                                                    </td>
                                                    <td className="px-4 py-3 text-center text-xs text-orange-700 font-medium">
                                                        {(() => {
                                                            if (fee && fee.expirationDate) {
                                                                // Firestore Timestamp or JS Date
                                                                if (fee.expirationDate.seconds) {
                                                                    return new Date(fee.expirationDate.seconds * 1000).toLocaleDateString();
                                                                } else if (fee.expirationDate.toDate) {
                                                                    return fee.expirationDate.toDate().toLocaleDateString();
                                                                } else if (fee.expirationDate instanceof Date) {
                                                                    return fee.expirationDate.toLocaleDateString();
                                                                }
                                                            }
                                                            // Fallback: calculate from paymentDate + plan duration
                                                            if (fee && fee.paymentDate && fee.paymentDate.seconds && h.subscriptionPlan) {
                                                                const planDuration = h.subscriptionPlan === 'basic' ? 1 : h.subscriptionPlan === 'pro' ? 3 : h.subscriptionPlan === 'premium' ? 12 : 1;
                                                                const paidDate = new Date(fee.paymentDate.seconds * 1000);
                                                                const expDate = new Date(paidDate);
                                                                expDate.setMonth(expDate.getMonth() + planDuration);
                                                                return expDate.toLocaleDateString();
                                                            }
                                                            return '-';
                                                        })()}
                                                    </td>
                                                    <td className="px-4 py-3 text-center">
                                                        {fee ? (
                                                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm bg-gradient-to-r from-green-400 to-green-500 text-white">Paid</span>
                                                        ) : (
                                                            <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600">Unpaid</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                                {/* Mobile stacked cards */}
                                <div className="flex flex-col gap-3 sm:hidden p-1">
                                    {hosts.map((h, idx) => {
                                        const fee = serviceFees.find(f => f.hostId === h.id && f.plan === h.subscriptionPlan);
                                        return (
                                            <div key={h.id} className={`bg-white border border-orange-100 rounded-xl shadow-sm p-4 flex flex-col gap-2 ${idx % 2 === 0 ? 'bg-orange-50/40' : 'bg-white'}`}>
                                                <div className="flex items-center gap-3 mb-1">
                                                    {h.photoURL ? (
                                                        <img src={h.photoURL} alt={h.fullName} className="w-9 h-9 rounded-full object-cover border-2 border-orange-200 shadow" />
                                                    ) : (
                                                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-base border-2 border-orange-200 shadow">
                                                            {h.fullName ? h.fullName.charAt(0).toUpperCase() : "?"}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-orange-900 text-sm truncate whitespace-nowrap max-w-[140px]">{h.fullName}</span>
                                                        <span className="text-xs text-orange-500 font-medium truncate whitespace-nowrap max-w-[140px]">{h.email}</span>
                                                    </div>
                                                </div>
                                                <div className="flex flex-wrap gap-2 text-xs text-orange-700">
                                                    <span className="font-semibold">Plan:</span> <span className="capitalize font-semibold">{h.subscriptionPlan}</span>
                                                    <span className="font-semibold ml-2">Fee:</span> {h.subscriptionPrice ? `₱${h.subscriptionPrice}` : '-'}
                                                    <span className="font-semibold ml-2">Paid:</span> {fee && fee.paymentDate && fee.paymentDate.seconds ? new Date(fee.paymentDate.seconds * 1000).toLocaleDateString() : '-'}
                                                    <span className="font-semibold ml-2">Expires:</span> {(() => {
                                                        if (fee && fee.expirationDate) {
                                                            if (fee.expirationDate.seconds) {
                                                                return new Date(fee.expirationDate.seconds * 1000).toLocaleDateString();
                                                            } else if (fee.expirationDate.toDate) {
                                                                return fee.expirationDate.toDate().toLocaleDateString();
                                                            } else if (fee.expirationDate instanceof Date) {
                                                                return fee.expirationDate.toLocaleDateString();
                                                            }
                                                        }
                                                        if (fee && fee.paymentDate && fee.paymentDate.seconds && h.subscriptionPlan) {
                                                            const planDuration = h.subscriptionPlan === 'basic' ? 1 : h.subscriptionPlan === 'pro' ? 3 : h.subscriptionPlan === 'premium' ? 12 : 1;
                                                            const paidDate = new Date(fee.paymentDate.seconds * 1000);
                                                            const expDate = new Date(paidDate);
                                                            expDate.setMonth(expDate.getMonth() + planDuration);
                                                            return expDate.toLocaleDateString();
                                                        }
                                                        return '-';
                                                    })()}
                                                    <span className="font-semibold ml-2">Status:</span> {fee ? (
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold shadow-sm bg-gradient-to-r from-green-400 to-green-500 text-white">Paid</span>
                                                    ) : (
                                                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold shadow-sm bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600">Unpaid</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Payment History Table */}
                <div className="overflow-x-auto bg-gradient-to-br from-blue-50 via-white to-blue-100 border border-blue-200 rounded-3xl mt-12 mb-8 p-2 sm:p-6">
                    <h3 className="text-2xl font-extrabold text-blue-900 px-2 sm:px-0 pt-2 pb-1 flex items-center gap-2">
                        <DollarSign className="w-7 h-7 text-blue-500" />
                        Payment History
                    </h3>
                    <p className="px-2 sm:px-0 pb-4 text-blue-700/80 text-sm">All service fee transactions by all hosts.</p>
                    <div className="rounded-2xl overflow-visible border border-blue-100">
                        {/* Desktop Table */}
                        <table className="w-full min-w-[900px] text-sm table-fixed hidden sm:table">
                            <colgroup>
                                <col style={{ width: '18%' }} />
                                <col style={{ width: '18%' }} />
                                <col style={{ width: '14%' }} />
                                <col style={{ width: '12%' }} />
                                <col style={{ width: '13%' }} />
                                <col style={{ width: '13%' }} />
                                <col style={{ width: '12%' }} />
                            </colgroup>
                            <thead className="bg-gradient-to-r from-blue-100 via-blue-50 to-white border-b-2 border-blue-200">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Host</th>
                                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Email</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Plan</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Amount</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Paid On</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Expires On</th>
                                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {serviceFees.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center text-blue-400 py-8 text-lg">No service fee payments found.</td></tr>
                                ) : serviceFees
                                    .slice()
                                    .sort((a, b) => {
                                        const aTime = a.paymentDate?.seconds ? a.paymentDate.seconds : 0;
                                        const bTime = b.paymentDate?.seconds ? b.paymentDate.seconds : 0;
                                        return bTime - aTime;
                                    })
                                    .filter(fee => hosts.find(h => h.id === fee.hostId))
                                    .map((fee, idx) => {
                                        // Host info
                                        const host = hosts.find(h => h.id === fee.hostId);
                                        // Paid On
                                        let paidOn = '-';
                                        if (fee.paymentDate) {
                                            if (fee.paymentDate.seconds) paidOn = new Date(fee.paymentDate.seconds * 1000).toLocaleDateString();
                                            else if (fee.paymentDate.toDate) paidOn = fee.paymentDate.toDate().toLocaleDateString();
                                            else if (fee.paymentDate instanceof Date) paidOn = fee.paymentDate.toLocaleDateString();
                                        }
                                        // Expires On
                                        let expiresOn = '-';
                                        if (fee.expirationDate) {
                                            if (fee.expirationDate.seconds) expiresOn = new Date(fee.expirationDate.seconds * 1000).toLocaleDateString();
                                            else if (fee.expirationDate.toDate) expiresOn = fee.expirationDate.toDate().toLocaleDateString();
                                            else if (fee.expirationDate instanceof Date) expiresOn = fee.expirationDate.toLocaleDateString();
                                        } else if (fee.paymentDate && fee.plan) {
                                            // Fallback: calculate from paymentDate + plan duration
                                            let paidDate = null;
                                            if (fee.paymentDate.seconds) paidDate = new Date(fee.paymentDate.seconds * 1000);
                                            else if (fee.paymentDate.toDate) paidDate = fee.paymentDate.toDate();
                                            else if (fee.paymentDate instanceof Date) paidDate = fee.paymentDate;
                                            if (paidDate) {
                                                const planDuration = fee.plan === 'basic' ? 1 : fee.plan === 'pro' ? 3 : fee.plan === 'premium' ? 12 : 1;
                                                const expDate = new Date(paidDate);
                                                expDate.setMonth(expDate.getMonth() + planDuration);
                                                expiresOn = expDate.toLocaleDateString();
                                            }
                                        }
                                        return (
                                            <tr
                                                key={fee.id}
                                                className={`transition-all ${idx % 2 === 0 ? 'bg-blue-50/60' : 'bg-white'} hover:bg-blue-100/80 border-b border-blue-100 last:border-0`}
                                            >
                                                <td className="px-4 py-3 font-semibold text-blue-900 flex items-center gap-2">
                                                    {host?.photoURL ? (
                                                        <img src={host.photoURL} alt={host.fullName} className="w-8 h-8 rounded-full object-cover border-2 border-blue-200 shadow" />
                                                    ) : (
                                                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-base border-2 border-blue-200 shadow">
                                                            {host?.fullName ? host.fullName.charAt(0).toUpperCase() : "?"}
                                                        </div>
                                                    )}
                                                    <div className="flex flex-col min-w-0">
                                                        <span className="font-bold text-blue-900 text-sm truncate whitespace-nowrap max-w-[120px]">{host?.fullName || '-'}</span>
                                                        <span className="text-xs text-blue-500 font-medium truncate whitespace-nowrap max-w-[120px]">{host?.email || '-'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-blue-800 text-sm truncate whitespace-nowrap max-w-[120px]">{host?.email || '-'}</td>
                                                <td className="px-4 py-3 capitalize text-blue-700 font-semibold text-center">{fee.plan}</td>
                                                <td className="px-4 py-3 text-blue-900 font-bold text-center">₱{fee.amount}</td>
                                                <td className="px-4 py-3 text-blue-700 text-center">{paidOn}</td>
                                                <td className="px-4 py-3 text-blue-700 text-center">{expiresOn}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {fee.status === 'paid' ? (
                                                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm bg-gradient-to-r from-green-400 to-green-500 text-white">Paid</span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold shadow-sm bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600">{fee.status}</span>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                            </tbody>
                        </table>
                        {/* Mobile stacked cards */}
                        <div className="flex flex-col gap-3 sm:hidden p-1">
                            {serviceFees.length === 0 ? (
                                <div className="text-center text-blue-400 py-8 text-lg">No service fee payments found.</div>
                            ) : serviceFees
                                .slice()
                                .sort((a, b) => {
                                    const aTime = a.paymentDate?.seconds ? a.paymentDate.seconds : 0;
                                    const bTime = b.paymentDate?.seconds ? b.paymentDate.seconds : 0;
                                    return bTime - aTime;
                                })
                                .filter(fee => hosts.find(h => h.id === fee.hostId))
                                .map((fee, idx) => {
                                    const host = hosts.find(h => h.id === fee.hostId);
                                    let paidOn = '-';
                                    if (fee.paymentDate) {
                                        if (fee.paymentDate.seconds) paidOn = new Date(fee.paymentDate.seconds * 1000).toLocaleDateString();
                                        else if (fee.paymentDate.toDate) paidOn = fee.paymentDate.toDate().toLocaleDateString();
                                        else if (fee.paymentDate instanceof Date) paidOn = fee.paymentDate.toLocaleDateString();
                                    }
                                    let expiresOn = '-';
                                    if (fee.expirationDate) {
                                        if (fee.expirationDate.seconds) expiresOn = new Date(fee.expirationDate.seconds * 1000).toLocaleDateString();
                                        else if (fee.expirationDate.toDate) expiresOn = fee.expirationDate.toDate().toLocaleDateString();
                                        else if (fee.expirationDate instanceof Date) expiresOn = fee.expirationDate.toLocaleDateString();
                                    } else if (fee.paymentDate && fee.plan) {
                                        let paidDate = null;
                                        if (fee.paymentDate.seconds) paidDate = new Date(fee.paymentDate.seconds * 1000);
                                        else if (fee.paymentDate.toDate) paidDate = fee.paymentDate.toDate();
                                        else if (fee.paymentDate instanceof Date) paidDate = fee.paymentDate;
                                        if (paidDate) {
                                            const planDuration = fee.plan === 'basic' ? 1 : fee.plan === 'pro' ? 3 : fee.plan === 'premium' ? 12 : 1;
                                            const expDate = new Date(paidDate);
                                            expDate.setMonth(expDate.getMonth() + planDuration);
                                            expiresOn = expDate.toLocaleDateString();
                                        }
                                    }
                                    return (
                                        <div key={fee.id} className={`bg-white border border-blue-100 rounded-xl shadow-sm p-4 flex flex-col gap-2 ${idx % 2 === 0 ? 'bg-blue-50/60' : 'bg-white'}`}>
                                            <div className="flex items-center gap-3 mb-1">
                                                {host?.photoURL ? (
                                                    <img src={host.photoURL} alt={host.fullName} className="w-8 h-8 rounded-full object-cover border-2 border-blue-200 shadow" />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-base border-2 border-blue-200 shadow">
                                                        {host?.fullName ? host.fullName.charAt(0).toUpperCase() : "?"}
                                                    </div>
                                                )}
                                                <div className="flex flex-col min-w-0">
                                                    <span className="font-bold text-blue-900 text-sm truncate whitespace-nowrap max-w-[120px]">{host?.fullName || '-'}</span>
                                                    <span className="text-xs text-blue-500 font-medium truncate whitespace-nowrap max-w-[120px]">{host?.email || '-'}</span>
                                                </div>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-xs text-blue-700">
                                                <span className="font-semibold">Plan:</span> <span className="capitalize font-semibold">{fee.plan}</span>
                                                <span className="font-semibold ml-2">Amount:</span> ₱{fee.amount}
                                                <span className="font-semibold ml-2">Paid:</span> {paidOn}
                                                <span className="font-semibold ml-2">Expires:</span> {expiresOn}
                                                <span className="font-semibold ml-2">Status:</span> {fee.status === 'paid' ? (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold shadow-sm bg-gradient-to-r from-green-400 to-green-500 text-white">Paid</span>
                                                ) : (
                                                    <span className="inline-block px-2 py-0.5 rounded-full text-xs font-bold shadow-sm bg-gradient-to-r from-gray-200 to-gray-300 text-gray-600">{fee.status}</span>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    </div>
                </div>
                {/* Payment History Modal (moved outside table/main) */}
            </main>
            {historyOpen && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-8 relative">
                        <button
                            className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 transition"
                            onClick={() => setHistoryOpen(false)}
                            aria-label="Close"
                        >
                            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                        <h3 className="text-2xl font-bold text-[#23364A] mb-4 flex items-center gap-2">
                            <DollarSign className="w-6 h-6 text-orange-500" />
                            Service Fee Payment History
                        </h3>
                        <div className="mb-4 text-gray-700 font-semibold">
                            Host: {historyHost?.fullName} <span className="text-gray-400">|</span> Email: {historyHost?.email}
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[600px]">
                                <thead className="bg-gradient-to-r from-orange-100 via-orange-50 to-white border-b-2 border-orange-200">
                                    <tr>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Plan</th>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Paid On</th>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Expires On</th>
                                        <th className="px-4 py-2 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-orange-50">
                                    {historyRows.length === 0 ? (
                                        <tr><td colSpan={5} className="text-center text-gray-400 py-6">No service fee payments found.</td></tr>
                                    ) : historyRows.map(fee => {
                                        // Paid On
                                        let paidOn = '-';
                                        if (fee.paymentDate) {
                                            if (fee.paymentDate.seconds) paidOn = new Date(fee.paymentDate.seconds * 1000).toLocaleDateString();
                                            else if (fee.paymentDate.toDate) paidOn = fee.paymentDate.toDate().toLocaleDateString();
                                            else if (fee.paymentDate instanceof Date) paidOn = fee.paymentDate.toLocaleDateString();
                                        }
                                        // Expires On
                                        let expiresOn = '-';
                                        if (fee.expirationDate) {
                                            if (fee.expirationDate.seconds) expiresOn = new Date(fee.expirationDate.seconds * 1000).toLocaleDateString();
                                            else if (fee.expirationDate.toDate) expiresOn = fee.expirationDate.toDate().toLocaleDateString();
                                            else if (fee.expirationDate instanceof Date) expiresOn = fee.expirationDate.toLocaleDateString();
                                        } else if (fee.paymentDate && fee.plan) {
                                            // Fallback: calculate from paymentDate + plan duration
                                            let paidDate = null;
                                            if (fee.paymentDate.seconds) paidDate = new Date(fee.paymentDate.seconds * 1000);
                                            else if (fee.paymentDate.toDate) paidDate = fee.paymentDate.toDate();
                                            else if (fee.paymentDate instanceof Date) paidDate = fee.paymentDate;
                                            if (paidDate) {
                                                const planDuration = fee.plan === 'basic' ? 1 : fee.plan === 'pro' ? 3 : fee.plan === 'premium' ? 12 : 1;
                                                const expDate = new Date(paidDate);
                                                expDate.setMonth(expDate.getMonth() + planDuration);
                                                expiresOn = expDate.toLocaleDateString();
                                            }
                                        }
                                        return (
                                            <tr key={fee.id}>
                                                <td className="px-4 py-2 capitalize">{fee.plan}</td>
                                                <td className="px-4 py-2">₱{fee.amount}</td>
                                                <td className="px-4 py-2">{paidOn}</td>
                                                <td className="px-4 py-2">{expiresOn}</td>
                                                <td className="px-4 py-2 capitalize">{fee.status}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

}
export default ServiceFees;

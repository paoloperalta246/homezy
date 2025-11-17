import { useState, useEffect, useRef, useCallback } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, orderBy, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "../Host View/images/homezy-logo.png";
import { LayoutDashboard, Users, DollarSign, FileText, Shield, Settings, LogOut, User, Book } from "lucide-react";

const Reservations = () => {
    const [admin, setAdmin] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [hosts, setHosts] = useState([]);
    const [guests, setGuests] = useState([]);
    const [bookings, setBookings] = useState([]);
    // Advanced filter state (host, status, date, plus search)
    const [filter, setFilter] = useState({
        search: "",
        host: "",
        status: "",
        startDate: "",
        endDate: ""
    });
    // Host options for filter
    const hostOptions = hosts.map(h => ({ id: h.id, name: h.fullName || h.email || 'Unknown Host' }));
    // Only show Approved and Rejected for status filter
    const statusOptions = ["approved", "rejected"];
    // Filtering helpers for bookings
    // Filtering logic: search, status (approved/rejected), date range
    const filteredBookings = bookings.filter(b => {
        // Status filter ("approved" means status === "confirmed")
        if (filter.status) {
            const status = (b.status || '').toLowerCase();
            if (filter.status === 'approved' && status !== 'confirmed') return false;
            if (filter.status === 'rejected' && status !== 'rejected') return false;
        }
        // Date filter (checkIn)
        if (filter.startDate) {
            const checkIn = b.checkIn?.seconds ? new Date(b.checkIn.seconds * 1000) : b.checkIn ? new Date(b.checkIn) : null;
            if (!checkIn || checkIn < new Date(filter.startDate + 'T00:00:00')) return false;
        }
        if (filter.endDate) {
            const checkIn = b.checkIn?.seconds ? new Date(b.checkIn.seconds * 1000) : b.checkIn ? new Date(b.checkIn) : null;
            if (!checkIn || checkIn > new Date(filter.endDate + 'T23:59:59')) return false;
        }
        // Search filter
        const search = filter.search.trim().toLowerCase();
        if (search) {
            return (
                (b.guestName || b.guestEmail || b.userId || "").toLowerCase().includes(search) ||
                (b.listingTitle || b.listingId || "").toLowerCase().includes(search) ||
                (b.status || "").toLowerCase().includes(search)
            );
        }
        return true;
    });
    const [currentPage, setCurrentPage] = useState(1);
    const [pageInput, setPageInput] = useState("");
    const BOOKINGS_PER_PAGE = 10;
    const [loadingData, setLoadingData] = useState(true);
    // PDF Preview Modal state
    const [pdfPreview, setPdfPreview] = useState({ open: false });
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [guestToDelete, setGuestToDelete] = useState(null);
    const [deleteError, setDeleteError] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteSuccess, setDeleteSuccess] = useState("");
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    // PDF Export helpers (Professional look, orange theme)
    // Orange: [251, 146, 60] (tailwind orange-400)
    const ORANGE = [251, 146, 60];
    const addPDFHeader = (doc, title, accentColor = ORANGE) => {
        doc.setFillColor(...accentColor);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(title, 16, 18);
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(1.2);
        doc.line(0, 28, 210, 28);
        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'normal');
    };

    const addPDFFooter = (doc, accentColor = ORANGE) => {
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(...accentColor);
            doc.text(`Generated: ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
                105, 292, { align: 'center' });
        }
    };



    // Export Bookings as PDF
    const exportBookingsPDF = () => {
        if (!filteredBookings.length) return;
        const doc = new jsPDF();
        addPDFHeader(doc, "Bookings", ORANGE);
        autoTable(doc, {
            startY: 34,
            head: [[
                "Property",
                "Guest",
                "Check-in",
                "Check-out",
                "Guests",
                "Amount",
                "Status"
            ]],
            body: filteredBookings.map(b => [
                b.listingTitle || b.listingId || '-',
                b.guestName || b.guestEmail || b.userId || '-',
                b.checkIn
                    ? new Date(b.checkIn.seconds ? b.checkIn.seconds * 1000 : b.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "N/A",
                b.checkOut
                    ? new Date(b.checkOut.seconds ? b.checkOut.seconds * 1000 : b.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : "N/A",
                (b.guests?.adults || 0) + (b.guests?.children || 0) + (b.guests?.infants || 0) + (b.guests?.pets || 0),
                `₱${(b.finalPrice || b.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                b.status === "confirmed"
                    ? "Approved"
                    : b.status
                        ? b.status.charAt(0).toUpperCase() + b.status.slice(1)
                        : "Active"
            ]),
            styles: { fontSize: 11, cellPadding: 4, lineColor: ORANGE, lineWidth: 0.2 },
            headStyles: { fillColor: ORANGE, textColor: 255, fontStyle: 'bold', fontSize: 12 },
            alternateRowStyles: { fillColor: [255, 247, 237] }, // light orange
            tableLineColor: ORANGE,
            tableLineWidth: 0.2,
            margin: { left: 10, right: 10 },
            didDrawPage: (data) => { },
        });
        addPDFFooter(doc, ORANGE);
        doc.save(`bookings_${Date.now()}.pdf`);
    };


    // Fetch all bookings and reviews for dynamic sections
    useEffect(() => {
        const fetchData = async () => {
            setLoadingData(true);
            try {
                // Fetch hosts
                const hostsSnap = await getDocs(collection(db, "hosts"));
                const hostsList = hostsSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(h => h.email && h.fullName); // Only valid hosts
                setHosts(hostsList);

                // Fetch guests
                const guestsSnap = await getDocs(collection(db, "guests"));
                const guestsList = guestsSnap.docs
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(g => g.email && g.fullName); // Only valid guests
                setGuests(guestsList);

                // Fetch all bookings
                const bookingsSnap = await getDocs(collection(db, "bookings"));
                const bookingsList = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setBookings(bookingsList);
            } catch (e) {
                console.error("Failed to fetch hosts, guests, or bookings", e);
            } finally {
                setLoadingData(false);
            }
        };
        fetchData();
    }, []);
    // Actions
    const handleDelete = async (type, id) => {
        if (type === "hosts") {
            if (!window.confirm("Are you sure you want to delete this user?")) return;
            try {
                await deleteDoc(doc(db, type, id));
                setHosts(hosts.filter(h => h.id !== id));
            } catch (e) {
                alert("Failed to delete user.");
            }
        } else if (type === "guests") {
            setGuestToDelete(id);
            setDeleteModalOpen(true);
            setDeleteError("");
        }
    };

    const confirmDeleteGuest = async () => {
        setDeleteLoading(true);
        setDeleteError("");
        try {
            // Find the guest object to get UID
            const guest = guests.find(g => g.id === guestToDelete);
            const uid = guest && guest.uid;
            await deleteDoc(doc(db, "guests", guestToDelete));
            setGuests(guests.filter(g => g.id !== guestToDelete));
            // Call backend to delete from Firebase Auth if UID exists
            if (uid) {
                try {
                    const res = await fetch("/api/delete-user", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ uid })
                    });
                    const data = await res.json();
                    if (!data.success) {
                        setDeleteError("Deleted from database, but failed to delete from Auth: " + (data.error || "Unknown error"));
                    }
                } catch (err) {
                    setDeleteError("Deleted from database, but failed to delete from Auth.");
                }
            }
            setDeleteModalOpen(false);
            setGuestToDelete(null);
            setDeleteSuccess("Guest successfully deleted.");
            setTimeout(() => setDeleteSuccess(""), 3500);
        } catch (e) {
            setDeleteError("Failed to delete user. Please try again.");
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleToggleVerified = async (type, id, current) => {
        try {
            await updateDoc(doc(db, type, id), { verified: !current });
            if (type === "hosts") setHosts(hosts.map(h => h.id === id ? { ...h, verified: !current } : h));
            if (type === "guests") setGuests(guests.map(g => g.id === id ? { ...g, verified: !current } : g));
        } catch (e) {
            alert("Failed to update verification status.");
        }
    };

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
                        {getNavItem("/reservations", "Reservations", Book)}
                        {getNavItem("/guests-hosts", "Guests & Hosts", Users)}
                        {getNavItem("/service-fees", "Service Fees", DollarSign)}
                        {getNavItem("/policy-compliance", "Policy & Compliance", Shield)}
                        {/* {getNavItem("/admin-reports", "Reports", FileText)}
            {getNavItem("/admin-settings", "Settings", Settings)} */}
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

            {/* Success Message */}
            {deleteSuccess && (
                <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50">
                    <div className="bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg font-semibold text-base animate-in fade-in duration-200">
                        {deleteSuccess}
                    </div>
                </div>
            )}
            {/* Main Content Header */}
            <main className="flex-1 px-2 sm:px-8 md:px-16 py-4 sm:py-8 md:py-10 pt-16 sm:pt-6 md:pt-10 md:ml-[260px] w-full max-w-full overflow-x-hidden">
                <div className="mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl md:text-[32px] font-bold mb-2 flex items-center gap-2">
                        <span className="p-1.5 sm:p-2 rounded-xl bg-orange-500/10 text-orange-600">
                            <Book className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
                        </span>
                        Reservations
                    </h2>
                    <p className="text-[#5E6282] text-sm sm:text-base md:text-lg mb-6 sm:mb-8">
                        Complete list of guest reservations all throughout the website.
                    </p>
                </div>
                {/* BOOKINGS TABLE PLACEHOLDER */}
                <div className="bg-white border border-gray-200 rounded-2xl shadow-md p-0 sm:p-6 mt-10 overflow-x-auto">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 pt-6 mb-2 gap-4">
                        <h3 className="text-2xl font-extrabold text-gray-900 flex items-center gap-3">
                            <Book className="w-6 h-6 text-orange-500" /> All Bookings
                        </h3>
                    </div>
                    {loadingData ? (
                        <div className="text-orange-400 text-xl font-semibold py-16 text-center animate-pulse">Loading bookings...</div>
                    ) : bookings.length === 0 ? (
                        <div className="text-orange-400 text-xl font-semibold py-16 text-center">No bookings found.</div>
                    ) : (
                        <>
                            {/* Filter UI */}
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4 px-6">
                                {/* Search */}
                                <div className="relative w-full sm:w-64">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-400">
                                        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                                    </span>
                                    <input
                                        type="text"
                                        className="pl-10 pr-4 py-2 border border-orange-200 rounded-xl shadow-inner w-full focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition"
                                        placeholder="Search by guest, listing, status..."
                                        value={filter.search}
                                        onChange={e => { setFilter(f => ({ ...f, search: e.target.value })); setCurrentPage(1); }}
                                    />
                                </div>
                                {/* Host Filter removed */}
                                {/* Status Filter: Only Approved or Rejected */}
                                <select
                                    className="px-3 py-2 rounded-lg border border-orange-200 bg-white text-orange-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 min-w-[110px]"
                                    value={filter.status}
                                    onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setCurrentPage(1); }}
                                >
                                    <option value="">All Statuses</option>
                                    <option value="approved">Approved</option>
                                    <option value="rejected">Rejected</option>
                                </select>
                                {/* Start Date Filter */}
                                <input
                                    type="date"
                                    className="px-3 py-2 rounded-lg border border-orange-200 bg-white text-orange-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 min-w-[140px]"
                                    value={filter.startDate}
                                    onChange={e => { setFilter(f => ({ ...f, startDate: e.target.value })); setCurrentPage(1); }}
                                    max={filter.endDate || undefined}
                                    placeholder="Start date"
                                    title="Start date"
                                />
                                {/* End Date Filter */}
                                <input
                                    type="date"
                                    className="px-3 py-2 rounded-lg border border-orange-200 bg-white text-orange-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 min-w-[140px]"
                                    value={filter.endDate}
                                    onChange={e => { setFilter(f => ({ ...f, endDate: e.target.value })); setCurrentPage(1); }}
                                    min={filter.startDate || undefined}
                                    placeholder="End date"
                                    title="End date"
                                />
                                <div className="flex-1" />
                                <button
                                    onClick={() => setPdfPreview({ open: true, type: 'bookings' })}
                                    className="group bg-gradient-to-r from-orange-500 to-orange-400 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 relative"
                                    style={{ minWidth: 160 }}
                                >
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                                    </span>
                                    <span className="tracking-wide">Export as PDF</span>
                                    <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
                                </button>
                                {/* PDF Preview Modal for Bookings */}
                                {pdfPreview.open && pdfPreview.type === 'bookings' && (
                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                        <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
                                            <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
                                                <h3 className="text-lg sm:text-xl font-semibold text-orange-600 flex items-center gap-2">
                                                    <Book className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 mr-1" />
                                                    Bookings PDF Preview
                                                </h3>
                                                <button
                                                    className="p-2 rounded-full hover:bg-gray-100 transition"
                                                    onClick={() => setPdfPreview({ open: false, type: null })}
                                                    aria-label="Close"
                                                >
                                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                </button>
                                            </div>
                                            <div className="px-4 sm:px-6 pt-3 pb-2 overflow-x-auto" style={{ maxHeight: '60vh' }}>
                                                <table className="w-full text-xs sm:text-sm border border-orange-200 rounded-lg">
                                                    <thead className="bg-gradient-to-r from-orange-50 to-orange-100 border-b-2 border-orange-200">
                                                        <tr>
                                                            <th className="px-2 py-2 text-left font-bold text-orange-700">Property</th>
                                                            <th className="px-2 py-2 text-left font-bold text-orange-700">Guest</th>
                                                            <th className="px-2 py-2 text-left font-bold text-orange-700">Check-in</th>
                                                            <th className="px-2 py-2 text-left font-bold text-orange-700">Check-out</th>
                                                            <th className="px-2 py-2 text-left font-bold text-orange-700">Guests</th>
                                                            <th className="px-2 py-2 text-left font-bold text-orange-700">Amount</th>
                                                            <th className="px-2 py-2 text-left font-bold text-orange-700">Status</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {filteredBookings.length === 0 ? (
                                                            <tr><td colSpan={7} className="text-center text-gray-400 py-4">No bookings found.</td></tr>
                                                        ) : (
                                                            filteredBookings.slice((currentPage - 1) * BOOKINGS_PER_PAGE, currentPage * BOOKINGS_PER_PAGE).map((b) => (
                                                                <tr key={b.id} className="border-b border-orange-50">
                                                                    <td className="px-2 py-2">{b.listingTitle || b.listingId || '-'}</td>
                                                                    <td className="px-2 py-2">{b.guestName || b.guestEmail || b.userId || '-'}</td>
                                                                    <td className="px-2 py-2">{b.checkIn ? (b.checkIn.seconds ? new Date(b.checkIn.seconds * 1000).toLocaleDateString() : new Date(b.checkIn).toLocaleDateString()) : 'N/A'}</td>
                                                                    <td className="px-2 py-2">{b.checkOut ? (b.checkOut.seconds ? new Date(b.checkOut.seconds * 1000).toLocaleDateString() : new Date(b.checkOut).toLocaleDateString()) : 'N/A'}</td>
                                                                    <td className="px-2 py-2">{(b.guests?.adults || 0) + (b.guests?.children || 0) + (b.guests?.infants || 0) + (b.guests?.pets || 0)}</td>
                                                                    <td className="px-2 py-2">₱{(b.finalPrice || b.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                                    <td className="px-2 py-2">{b.status === 'confirmed' ? 'Approved' : b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : 'Active'}</td>
                                                                </tr>
                                                            ))
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <div className="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2 border-t border-gray-100">
                                                <button
                                                    className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-lg shadow transition"
                                                    onClick={() => { exportBookingsPDF(); setPdfPreview({ open: false, type: null }); }}
                                                    disabled={filteredBookings.length === 0}
                                                >
                                                    Export to PDF
                                                </button>
                                                <button
                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg transition"
                                                    onClick={() => setPdfPreview({ open: false, type: null })}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className="w-full max-w-full">
                                <table className="w-full max-w-full">
                                    <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-orange-200">
                                        <tr>
                                            <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Property</th>
                                            <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                                            <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Check-in</th>
                                            <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Check-out</th>
                                            <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guests</th>
                                            <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                                            <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {(() => {
                                            // Filtering (use filteredBookings)
                                            const totalPages = Math.ceil(filteredBookings.length / BOOKINGS_PER_PAGE) || 1;
                                            const page = Math.max(1, Math.min(currentPage, totalPages));
                                            const startIdx = (page - 1) * BOOKINGS_PER_PAGE;
                                            const paged = filteredBookings.slice(startIdx, startIdx + BOOKINGS_PER_PAGE);
                                            Reservations._filteredBookings = filteredBookings;
                                            Reservations._totalPages = totalPages;
                                            Reservations._currentPage = page;
                                            return paged
                                                .filter(b =>
                                                    (b.listingTitle || b.listingId) &&
                                                    (b.guestName || b.guestEmail || b.userId) &&
                                                    (b.checkIn || b.checkOut) &&
                                                    (b.finalPrice || b.price)
                                                )
                                                .map((b) => {
                                                    // Listing image and title
                                                    const listingImg = b.listingImage || "/default-listing.png";
                                                    // Guest avatar/initials
                                                    let guest = b.guestName || b.guestEmail || b.userId || "-";
                                                    let initials = guest && typeof guest === 'string' ? guest.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '?';
                                                    // Status badge
                                                    let statusClass = "bg-gradient-to-r from-blue-500 to-blue-600 text-white";
                                                    if (["confirmed", "approved", "accepted", "completed"].includes((b.status || "").toLowerCase())) statusClass = "bg-gradient-to-r from-green-500 to-green-600 text-white";
                                                    else if (["pending", "awaiting"].includes((b.status || "").toLowerCase())) statusClass = "bg-gradient-to-r from-yellow-400 to-yellow-500 text-yellow-900";
                                                    else if (["cancelled", "rejected", "declined"].includes((b.status || "").toLowerCase())) statusClass = "bg-gradient-to-r from-red-500 to-red-600 text-white";
                                                    return (
                                                        <tr key={b.id} className="hover:bg-orange-50/30 transition-all duration-200">
                                                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                                                                <div className="flex items-center gap-2 sm:gap-3">
                                                                    <div className="relative">
                                                                        <img
                                                                            src={listingImg}
                                                                            alt={b.listingTitle}
                                                                            className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl object-cover ring-2 ring-gray-100"
                                                                        />
                                                                        <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                                                                    </div>
                                                                    <div className="flex-1 min-w-0">
                                                                        <p className="font-semibold text-gray-800 text-xs sm:text-sm line-clamp-1">
                                                                            {b.listingTitle || b.listingId || '-'}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                                                                            Booked {b.createdAt?.seconds
                                                                                ? new Date(b.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                                                                                : "N/A"}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                                                        {initials}
                                                                    </div>
                                                                    <div>
                                                                        <p className="font-medium text-gray-800 text-xs sm:text-sm">
                                                                            {b.guestName || "Guest"}
                                                                        </p>
                                                                        <p className="text-xs text-gray-500 truncate max-w-[100px] sm:max-w-[150px]">
                                                                            {b.guestEmail || ""}
                                                                        </p>
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                                                                    </div>
                                                                    <p className="text-xs sm:text-sm text-gray-800 font-medium">
                                                                        {b.checkIn
                                                                            ? new Date(b.checkIn.seconds ? b.checkIn.seconds * 1000 : b.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                                            : "N/A"}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                                                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>
                                                                    </div>
                                                                    <p className="text-xs sm:text-sm text-gray-800 font-medium">
                                                                        {b.checkOut
                                                                            ? new Date(b.checkOut.seconds ? b.checkOut.seconds * 1000 : b.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                                                            : "N/A"}
                                                                    </p>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-100 rounded-lg flex items-center justify-center">
                                                                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                                                    </div>
                                                                    <span className="text-xs sm:text-sm font-semibold text-gray-800">
                                                                        {(b.guests?.adults || 0) + (b.guests?.children || 0) + (b.guests?.infants || 0) + (b.guests?.pets || 0)}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                                                                <div>
                                                                    <p className="font-bold text-gray-800 text-sm sm:text-base">
                                                                        ₱{(b.finalPrice || b.price || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </p>
                                                                    {b.couponUsed && (
                                                                        <p className="text-xs text-green-600 font-medium flex items-center gap-1 mt-1">
                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></svg>
                                                                            Saved ₱{(b.discount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                                                                <span className={`inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold shadow-sm ${statusClass}`}>
                                                                    {b.status === "confirmed" ? "Approved" : b.status ? b.status.charAt(0).toUpperCase() + b.status.slice(1) : "Active"}
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                });
                                        })()}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination Controls */}
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-8 px-6 pb-6">
                                <div className="text-base text-orange-500 font-semibold">
                                    Page {Reservations._currentPage} of {Reservations._totalPages}
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button
                                        className="px-4 py-2 rounded-full border border-orange-200 bg-white text-orange-600 font-bold shadow hover:bg-orange-100 disabled:opacity-50 transition"
                                        onClick={() => setCurrentPage(1)}
                                        disabled={Reservations._currentPage === 1}
                                    >First</button>
                                    <button
                                        className="px-4 py-2 rounded-full border border-orange-200 bg-white text-orange-600 font-bold shadow hover:bg-orange-100 disabled:opacity-50 transition"
                                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        disabled={Reservations._currentPage === 1}
                                    >Prev</button>
                                    <input
                                        type="number"
                                        min={1}
                                        max={Reservations._totalPages}
                                        value={pageInput}
                                        onChange={e => setPageInput(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                                const n = parseInt(pageInput);
                                                if (!isNaN(n) && n >= 1 && n <= Reservations._totalPages) setCurrentPage(n);
                                                setPageInput("");
                                            }
                                        }}
                                        className="w-14 px-2 py-1 rounded-lg border border-orange-200 text-center text-orange-600 font-bold focus:ring-2 focus:ring-orange-300 focus:border-orange-400 transition"
                                        placeholder="#"
                                    />
                                    <button
                                        className="px-4 py-2 rounded-full border border-orange-200 bg-white text-orange-600 font-bold shadow hover:bg-orange-100 disabled:opacity-50 transition"
                                        onClick={() => setCurrentPage(p => Math.min(Reservations._totalPages, p + 1))}
                                        disabled={Reservations._currentPage === Reservations._totalPages}
                                    >Next</button>
                                    <button
                                        className="px-4 py-2 rounded-full border border-orange-200 bg-white text-orange-600 font-bold shadow hover:bg-orange-100 disabled:opacity-50 transition"
                                        onClick={() => setCurrentPage(Reservations._totalPages)}
                                        disabled={Reservations._currentPage === Reservations._totalPages}
                                    >Last</button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Reservations;

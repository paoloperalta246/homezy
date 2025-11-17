import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { collection, doc, getDoc, getDocs, updateDoc, addDoc, query, where } from "firebase/firestore";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";

import { auth, db } from "../../firebase";
import homezyLogo from "../Host View/images/homezy-logo.png";
import { LayoutDashboard, Users, DollarSign, FileText, Shield, Settings, LogOut, User, Book } from "lucide-react";

const AdminDashboard = () => {
  const [admin, setAdmin] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [serviceFeesTotal, setServiceFeesTotal] = useState(null);
  const [guestWishlists, setGuestWishlists] = useState([]);
  // Track which wishlists have been marked as read (by id)
  const [readWishlists, setReadWishlists] = useState([]);
  // Toast/modal state
  const [showReadToast, setShowReadToast] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  // PDF Preview modal state
  const [pdfPreview, setPdfPreview] = useState({ open: false, type: null });
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
  const [commentModal, setCommentModal] = useState({ open: false, comment: '', guest: '', property: '' });
  const [loadingData, setLoadingData] = useState(true);
  const [hostCount, setHostCount] = useState(null);
  const [guestCount, setGuestCount] = useState(null);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;


  // PDF Export helpers (Enhanced for professional look)
  // Helper: Add header with logo and title
  const addPDFHeader = (doc, title, accentColor = [236, 72, 153]) => {
    // Draw colored header background
    doc.setFillColor(...accentColor);
    doc.rect(0, 0, 210, 28, 'F');
    // Removed logo for cleaner header
    // Title
    doc.setFontSize(20);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 16, 18); // Start title closer to the left
    // Brand line
    doc.setDrawColor(...accentColor);
    doc.setLineWidth(1.2);
    doc.line(0, 28, 210, 28);
    doc.setTextColor(40, 40, 40);
    doc.setFont('helvetica', 'normal');
  };

  // Helper: Add footer with page number and date
  const addPDFFooter = (doc, accentColor = [236, 72, 153]) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(...accentColor);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
        105, 292, { align: 'center' });
    }
  };

  // Helper: Watermark (optional)
  const addPDFWatermark = (doc, text = "Homezy", color = [236, 72, 153]) => {
    doc.setFontSize(40);
    doc.setTextColor(...color, 30); // 30 alpha for watermark
    doc.text(text, 105, 150, { align: 'center', angle: 30 });
    doc.setTextColor(40, 40, 40);
  };

  // Enhanced Wishlists PDF
  const exportWishlistsPDF = () => {
    if (!guestWishlists.length) return;
    const doc = new jsPDF();
    addPDFHeader(doc, "Guest Wishlists", [236, 72, 153]);
    autoTable(doc, {
      startY: 34,
      head: [["Guest", "Email", "Wishlist", "Date Added"]],
      body: guestWishlists.map(w => [
        w.guestName || '',
        w.guestEmail || '',
        w.text || w.itemName || w.title || w.name || '',
        w.createdAt?.seconds
          ? new Date(w.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ''
      ]),
      styles: { fontSize: 11, cellPadding: 4, lineColor: [236, 72, 153], lineWidth: 0.2 },
      headStyles: { fillColor: [236, 72, 153], textColor: 255, fontStyle: 'bold', fontSize: 12 },
      alternateRowStyles: { fillColor: [255, 245, 250] },
      tableLineColor: [236, 72, 153],
      tableLineWidth: 0.2,
      margin: { left: 10, right: 10 },
      didDrawPage: (data) => {
        // Watermark (optional)
        // addPDFWatermark(doc, "Homezy", [236, 72, 153]);
      },
    });
    addPDFFooter(doc, [236, 72, 153]);
    doc.save(`guest_wishlists_${Date.now()}.pdf`);
  };

  // Enhanced Recent Bookings PDF
  const exportRecentBookingsPDF = () => {
    if (!recentBookings.length) return;
    const doc = new jsPDF();
    addPDFHeader(doc, "Recent Bookings", [59, 130, 246]);
    autoTable(doc, {
      startY: 34,
      head: [["Property", "Guest", "Email", "Check-in", "Check-out", "Amount"]],
      body: recentBookings.map(b => [
        b.listingTitle || '',
        b.guestName || '',
        b.guestEmail || '',
        b.checkIn?.seconds
          ? new Date(b.checkIn.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : b.checkIn ? new Date(b.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : '',
        b.checkOut?.seconds
          ? new Date(b.checkOut.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
          : b.checkOut ? new Date(b.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : '',
        `₱${(b.finalPrice || b.price || 0).toLocaleString()}.00`
      ]),
      styles: { fontSize: 11, cellPadding: 4, lineColor: [59, 130, 246], lineWidth: 0.2 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: 'bold', fontSize: 12 },
      alternateRowStyles: { fillColor: [239, 246, 255] },
      tableLineColor: [59, 130, 246],
      tableLineWidth: 0.2,
      margin: { left: 10, right: 10 },
      didDrawPage: (data) => {
        // addPDFWatermark(doc, "Homezy", [59, 130, 246]);
      },
    });
    addPDFFooter(doc, [59, 130, 246]);
    doc.save(`recent_bookings_${Date.now()}.pdf`);
  };

  // Enhanced Best Reviews PDF
  const exportBestReviewsPDF = () => {
    const best = reviews.filter(r => typeof r.rating === 'number').sort((a, b) => b.rating - a.rating).slice(0, 5);
    if (!best.length) return;
    const doc = new jsPDF();
    addPDFHeader(doc, "Best Reviewed Bookings", [16, 185, 129]);
    autoTable(doc, {
      startY: 34,
      head: [["Property", "Guest", "Email", "Rating", "Comment"]],
      body: best.map(r => [
        r.listingName || r.listingTitle || '',
        r.name || '',
        r.email || '',
        r.rating,
        r.comment || ''
      ]),
      styles: { fontSize: 11, cellPadding: 4, lineColor: [16, 185, 129], lineWidth: 0.2 },
      headStyles: { fillColor: [16, 185, 129], textColor: 255, fontStyle: 'bold', fontSize: 12 },
      alternateRowStyles: { fillColor: [236, 253, 245] },
      tableLineColor: [16, 185, 129],
      tableLineWidth: 0.2,
      margin: { left: 10, right: 10 },
      columnStyles: { 4: { cellWidth: 60 } },
      didDrawPage: (data) => {
        // addPDFWatermark(doc, "Homezy", [16, 185, 129]);
      },
    });
    addPDFFooter(doc, [16, 185, 129]);
    doc.save(`best_reviews_${Date.now()}.pdf`);
  };

  // Enhanced Lowest Reviews PDF
  const exportLowestReviewsPDF = () => {
    const lowest = reviews.filter(r => typeof r.rating === 'number').sort((a, b) => a.rating - b.rating).slice(0, 5);
    if (!lowest.length) return;
    const doc = new jsPDF();
    addPDFHeader(doc, "Lowest Reviewed Bookings", [239, 68, 68]);
    autoTable(doc, {
      startY: 34,
      head: [["Property", "Guest", "Email", "Rating", "Comment"]],
      body: lowest.map(r => [
        r.listingName || r.listingTitle || '',
        r.name || '',
        r.email || '',
        r.rating,
        r.comment || ''
      ]),
      styles: { fontSize: 11, cellPadding: 4, lineColor: [239, 68, 68], lineWidth: 0.2 },
      headStyles: { fillColor: [239, 68, 68], textColor: 255, fontStyle: 'bold', fontSize: 12 },
      alternateRowStyles: { fillColor: [254, 242, 242] },
      tableLineColor: [239, 68, 68],
      tableLineWidth: 0.2,
      margin: { left: 10, right: 10 },
      columnStyles: { 4: { cellWidth: 60 } },
      didDrawPage: (data) => {
        // addPDFWatermark(doc, "Homezy", [239, 68, 68]);
      },
    });
    addPDFFooter(doc, [239, 68, 68]);
    doc.save(`lowest_reviews_${Date.now()}.pdf`);
  };

  // Mark wishlist as read and notify guest
  const handleMarkWishlistAsRead = async (wishlist) => {
    // Disable button immediately
    setReadWishlists((prev) => [...prev, wishlist.id]);
    // Show toast/modal
    setToastMsg('Wishlist has been marked as read!');
    setShowReadToast(true);
    setTimeout(() => setShowReadToast(false), 2500);
    // Optionally update wishlist as read in Firestore
    try {
      if (wishlist.id) {
        await updateDoc(doc(db, "guestWishlist", wishlist.id), { read: true });
      }
    } catch (e) {
      // ignore if fails
    }
    // Send notification to guest
    try {
      const guestId = wishlist.guestId || wishlist.guestUid || wishlist.uid || wishlist.userId;
      if (!guestId) return;
      await addDoc(collection(db, "guestNotifications"), {
        userId: guestId,
        type: "wishlist_read",
        title: "Wishlist Read by Admin",
        message: "Your wishlist has been read by the admin.",
        timestamp: new Date(),
        read: false,
        wishlistId: wishlist.id || null,
      });
    } catch (e) {
      console.error("Failed to send notification to guest:", e);
    }
  };

  // Fetch all bookings and reviews for dynamic sections
  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        // Fetch bookings
        const bookingsSnap = await getDocs(collection(db, "bookings"));
        const bookingsList = bookingsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setBookings(bookingsList);

        // Fetch reviews
        const reviewsSnap = await getDocs(collection(db, "reviews"));
        const reviewsList = reviewsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setReviews(reviewsList);

        // Fetch hosts count (only those with non-empty email)
        const hostsSnap = await getDocs(query(collection(db, "hosts"), where("email", ">", "")));
        setHostCount(hostsSnap.size);

        // Fetch guests count (only those with non-empty email)
        const guestsSnap = await getDocs(query(collection(db, "guests"), where("email", ">", "")));
        setGuestCount(guestsSnap.size);

        // Fetch total service fees (all paid)
        const feesSnap = await getDocs(query(collection(db, "serviceFees"), where("status", "==", "paid")));
        const totalFees = feesSnap.docs.reduce((sum, doc) => {
          const data = doc.data();
          return sum + (typeof data.amount === 'number' ? data.amount : 0);
        }, 0);
        setServiceFeesTotal(totalFees);

        // Fetch guest wishlists
        const wishlistsSnap = await getDocs(collection(db, "guestWishlist"));
        const wishlistsList = wishlistsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setGuestWishlists(wishlistsList);
      } catch (e) {
        console.error("Failed to fetch bookings, reviews, hosts, guests, service fees, or wishlists", e);
        setServiceFeesTotal(null);
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
              <h1 className="text-[26px] font-bold text-[#23364A] leading-tight truncate whitespace-nowrap">Homezy</h1>
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

      {/* Main Content */}
      <main className="flex-1 px-2 sm:px-8 md:px-16 py-6 sm:py-8 md:py-10 pt-16 sm:pt-6 md:pt-10 md:ml-[260px] w-full max-w-full overflow-x-hidden">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl md:text-[32px] font-bold mb-2 flex items-center gap-2 truncate whitespace-nowrap">
            <span className="p-1.5 sm:p-2 rounded-xl bg-orange-500/10 text-orange-600">
              <LayoutDashboard className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            </span>
            <span className="truncate whitespace-nowrap">Dashboard</span>
          </h2>
          <p className="text-[#5E6282] text-sm sm:text-base md:text-lg mb-6 sm:mb-8 truncate whitespace-nowrap max-w-full">
            Quick insights into users, bookings, and trends.
          </p>
        </div>

        {/* Placeholder content */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-10">
          {/* Total Bookings */}
          <div className="relative bg-gradient-to-br from-blue-50 via-blue-100 to-blue-200 rounded-2xl p-4 sm:p-7 shadow-lg overflow-hidden border border-blue-100 hover:shadow-2xl transition-all group min-w-0">
            <div className="absolute right-4 top-4 opacity-10 text-blue-400 text-7xl pointer-events-none select-none">
              <Users className="w-20 h-20" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-4 rounded-xl shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-blue-700">Total Bookings</span>
            </div>
            <p className="text-4xl font-extrabold text-blue-900 mb-1">{loadingData ? '--' : totalConfirmedBookings}</p>
            <p className="text-sm text-blue-500 font-medium">Confirmed bookings</p>
          </div>

          {/* Service Fees */}
          <div className="relative bg-gradient-to-br from-green-50 via-green-100 to-green-200 rounded-2xl p-4 sm:p-7 shadow-lg overflow-hidden border border-green-100 hover:shadow-2xl transition-all group min-w-0">
            <div className="absolute right-4 top-4 opacity-10 text-green-400 text-7xl pointer-events-none select-none">
              <DollarSign className="w-20 h-20" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-green-500 to-green-700 p-4 rounded-xl shadow-lg">
                <DollarSign className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-green-700">Service Fees</span>
            </div>
            <p className="text-4xl font-extrabold text-green-900 mb-1">
              {loadingData || serviceFeesTotal === null ? '₱ --' : `₱${serviceFeesTotal.toLocaleString()}`}
            </p>
            <p className="text-sm text-green-500 font-medium">Total platform fees</p>
          </div>


          {/* Total Hosts */}
          <div className="relative bg-gradient-to-br from-purple-50 via-purple-100 to-purple-200 rounded-2xl p-4 sm:p-7 shadow-lg overflow-hidden border border-purple-100 hover:shadow-2xl transition-all group min-w-0">
            <div className="absolute right-4 top-4 opacity-10 text-purple-400 text-7xl pointer-events-none select-none">
              <User className="w-20 h-20" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-purple-500 to-purple-700 p-4 rounded-xl shadow-lg">
                <User className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-purple-700">Total Hosts</span>
            </div>
            <p className="text-4xl font-extrabold text-purple-900 mb-1">{loadingData || hostCount === null ? '--' : hostCount}</p>
            <p className="text-sm text-purple-500 font-medium">Registered hosts</p>
          </div>


          {/* Total Guests */}
          <div className="relative bg-gradient-to-br from-orange-50 via-orange-100 to-orange-200 rounded-2xl p-4 sm:p-7 shadow-lg overflow-hidden border border-orange-100 hover:shadow-2xl transition-all group min-w-0">
            <div className="absolute right-4 top-4 opacity-10 text-orange-400 text-7xl pointer-events-none select-none">
              <Users className="w-20 h-20" />
            </div>
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-gradient-to-br from-orange-500 to-orange-700 p-4 rounded-xl shadow-lg">
                <Users className="w-7 h-7 text-white" />
              </div>
              <span className="text-lg font-semibold text-orange-700">Total Guests</span>
            </div>
            <p className="text-4xl font-extrabold text-orange-900 mb-1">{loadingData || guestCount === null ? '--' : guestCount}</p>
            <p className="text-sm text-orange-500 font-medium">Registered guests</p>
          </div>
        </div>

        {/* Guest Wishlists Table */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-pink-500/10">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-pink-600" />
              </div>
              <span>Guest Wishlists</span>
            </h3>
            <button
              onClick={() => setPdfPreview({ open: true, type: 'wishlists' })}
              className="group relative bg-gradient-to-r from-pink-500 to-pink-400 via-pink-600 to-pink-500 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-300"
              style={{ minWidth: 140 }}
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </span>
              <span className="tracking-wide">Export Wishlists PDF</span>
              <span className="absolute -top-2 -right-2 bg-pink-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
            </button>
                {/* PDF Preview Modal */}
                {pdfPreview.open && pdfPreview.type === 'wishlists' && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
                      <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
                        <h3 className="text-lg sm:text-xl font-semibold text-pink-600 flex items-center gap-2">
                          <Users className="w-5 h-5 sm:w-6 sm:h-6 text-pink-500 mr-1" />
                          Guest Wishlists Preview
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
                        <table className="w-full text-xs sm:text-sm border border-pink-200 rounded-lg">
                          <thead className="bg-gradient-to-r from-pink-50 to-pink-100 border-b-2 border-pink-200">
                            <tr>
                              <th className="px-2 py-2 text-left font-bold text-pink-700">Guest</th>
                              <th className="px-2 py-2 text-left font-bold text-pink-700">Email</th>
                              <th className="px-2 py-2 text-left font-bold text-pink-700">Wishlist</th>
                              <th className="px-2 py-2 text-left font-bold text-pink-700">Date Added</th>
                            </tr>
                          </thead>
                          <tbody>
                            {guestWishlists.length === 0 ? (
                              <tr><td colSpan={4} className="text-center text-gray-400 py-4">No wishlists found.</td></tr>
                            ) : (
                              guestWishlists.map((w) => (
                                <tr key={w.id} className="border-b border-pink-50">
                                  <td className="px-2 py-2">{w.guestName || 'Guest'}</td>
                                  <td className="px-2 py-2">{w.guestEmail || ''}</td>
                                  <td className="px-2 py-2">{w.text || w.itemName || w.title || w.name || '—'}</td>
                                  <td className="px-2 py-2">{w.createdAt?.seconds
                                    ? new Date(w.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}</td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                      <div className="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2 border-t border-gray-100">
                        <button
                          className="bg-pink-500 hover:bg-pink-600 text-white font-bold px-6 py-2 rounded-lg shadow transition"
                          onClick={() => { exportWishlistsPDF(); setPdfPreview({ open: false, type: null }); }}
                          disabled={guestWishlists.length === 0}
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
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md w-full max-w-full overflow-x-auto">
            {/* Desktop/tablet table */}
            <table className="w-full max-w-full hidden sm:table" style={{ tableLayout: 'fixed' }}>
              <thead className="bg-gradient-to-r from-pink-50 to-pink-100 border-b-2 border-pink-200">
                <tr>
                  <th style={{ width: '20%' }} className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                  <th style={{ width: '20%' }} className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                  <th style={{ width: '20%' }} className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Wishlist</th>
                  <th style={{ width: '20%' }} className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Date Added</th>
                  <th style={{ width: '20%' }} className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingData ? (
                  <tr>
                    <td className="px-3 sm:px-4 md:px-6 py-4 text-pink-400 italic" colSpan={5}>
                      Loading wishlists...
                    </td>
                  </tr>
                ) : guestWishlists.length === 0 ? (
                  <tr>
                    <td className="px-3 sm:px-4 md:px-6 py-4 text-gray-400 italic" colSpan={5}>
                      No wishlists found.
                    </td>
                  </tr>
                ) : (
                  guestWishlists.map((w) => (
                    <tr key={w.id} className="hover:bg-pink-50/30 transition-all duration-200">
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                          {w.guestPhoto ? (
                            <img src={w.guestPhoto} alt={w.guestName || 'Guest'} className="w-8 h-8 rounded-full object-cover border border-pink-200 shadow" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold text-xs">
                              {(w.guestName || w.guestEmail || 'G').charAt(0).toUpperCase()}
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-gray-800 text-xs sm:text-sm">
                              {w.guestName || 'Guest'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">{w.guestEmail || ''}</td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">{w.text || w.itemName || w.title || w.name || '—'}</td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">{w.createdAt?.seconds
                        ? new Date(w.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}</td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <button
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold shadow transition ${readWishlists.includes(w.id) || w.read ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-green-500 hover:bg-green-600 text-white'}`}
                          onClick={() => handleMarkWishlistAsRead(w)}
                          disabled={readWishlists.includes(w.id) || w.read}
                        >
                          {readWishlists.includes(w.id) || w.read ? 'Marked as Read' : 'Mark as Read'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {/* Toast/Modal for Mark as Read */}
            {showReadToast && (
              <div className="fixed top-6 left-1/2 transform -translate-x-1/2 z-[99999] bg-green-500 text-white px-6 py-3 rounded-xl shadow-lg text-lg font-semibold animate-fade-in">
                {toastMsg}
              </div>
            )}
            {/* Mobile stacked cards */}
            <div className="flex flex-col gap-3 sm:hidden p-1">
              {loadingData ? (
                <div className="text-pink-400 italic text-center py-4 bg-pink-50 rounded-lg">Loading wishlists...</div>
              ) : guestWishlists.length === 0 ? (
                <div className="text-gray-400 italic text-center py-4 bg-pink-50 rounded-lg">No wishlists found.</div>
              ) : (
                guestWishlists.map((w) => (
                  <div key={w.id} className="bg-white border border-pink-100 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-3 mb-1">
                      {w.guestPhoto ? (
                        <img src={w.guestPhoto} alt={w.guestName || 'Guest'} className="w-10 h-10 rounded-full object-cover border border-pink-200 shadow" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-pink-600 flex items-center justify-center text-white font-bold text-base">
                          {(w.guestName || w.guestEmail || 'G').charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-800 text-sm">{w.guestName || 'Guest'}</p>
                        <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[120px]">{w.guestEmail || ''}</p>
                      </div>
                    </div>
                    <div className="text-xs text-gray-700 truncate whitespace-nowrap max-w-[180px]"><span className="font-semibold">Wishlist:</span> {w.text || w.itemName || w.title || w.name || '—'}</div>
                    <div className="text-xs text-gray-700 truncate whitespace-nowrap max-w-[180px]"><span className="font-semibold">Date Added:</span> {w.createdAt?.seconds
                      ? new Date(w.createdAt.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                      : w.createdAt ? new Date(w.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        {/* Recent Bookings Section - like Host Recent Reservations */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-blue-500/10">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
              </div>
              <span>Recent Bookings</span>
            </h3>
            <button
              onClick={() => setPdfPreview({ open: true, type: 'recentBookings' })}
              className="group relative bg-gradient-to-r from-blue-500 to-blue-400 via-blue-600 to-blue-500 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300"
              style={{ minWidth: 140 }}
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </span>
              <span className="tracking-wide">Export Bookings PDF</span>
              <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
            </button>
            {/* PDF Preview Modal for Recent Bookings */}
            {pdfPreview.open && pdfPreview.type === 'recentBookings' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
                    <h3 className="text-lg sm:text-xl font-semibold text-blue-600 flex items-center gap-2">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mr-1" />
                      Recent Bookings Preview
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
                    <table className="w-full text-xs sm:text-sm border border-blue-200 rounded-lg">
                      <thead className="bg-gradient-to-r from-blue-50 to-blue-100 border-b-2 border-blue-200">
                        <tr>
                          <th className="px-2 py-2 text-left font-bold text-blue-700">Property</th>
                          <th className="px-2 py-2 text-left font-bold text-blue-700">Guest</th>
                          <th className="px-2 py-2 text-left font-bold text-blue-700">Email</th>
                          <th className="px-2 py-2 text-left font-bold text-blue-700">Check-in</th>
                          <th className="px-2 py-2 text-left font-bold text-blue-700">Check-out</th>
                          <th className="px-2 py-2 text-left font-bold text-blue-700">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentBookings.length === 0 ? (
                          <tr><td colSpan={6} className="text-center text-gray-400 py-4">No bookings found.</td></tr>
                        ) : (
                          recentBookings.map((b) => (
                            <tr key={b.id} className="border-b border-blue-50">
                              <td className="px-2 py-2">{b.listingTitle || '—'}</td>
                              <td className="px-2 py-2">{b.guestName || 'Guest'}</td>
                              <td className="px-2 py-2">{b.guestEmail || ''}</td>
                              <td className="px-2 py-2">{b.checkIn?.seconds
                                ? new Date(b.checkIn.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : b.checkIn ? new Date(b.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}</td>
                              <td className="px-2 py-2">{b.checkOut?.seconds
                                ? new Date(b.checkOut.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : b.checkOut ? new Date(b.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}</td>
                              <td className="px-2 py-2">₱{(b.finalPrice || b.price || 0).toLocaleString()}.00</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2 border-t border-gray-100">
                    <button
                      className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2 rounded-lg shadow transition"
                      onClick={() => { exportRecentBookingsPDF(); setPdfPreview({ open: false, type: null }); }}
                      disabled={recentBookings.length === 0}
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
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md overflow-x-auto w-full max-w-full">
            {loadingData ? (
              <p className="text-blue-400 p-6">Loading bookings...</p>
            ) : recentBookings.length === 0 ? (
              <p className="text-blue-400 p-6">No bookings found.</p>
            ) : (
              <table className="w-full max-w-full text-xs sm:text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-blue-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Property</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Check-in</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Check-out</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {recentBookings.map((b) => (
                    <tr key={b.id} className="hover:bg-blue-50/30 transition-all duration-200">
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 sm:gap-3">
                          <div className="relative">
                            <img
                              src={b.listingImage || "/default-listing.png"}
                              alt={b.listingTitle}
                              className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl object-cover ring-2 ring-gray-100"
                            />
                            <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[120px]">
                              {b.listingTitle || '—'}
                            </p>
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate whitespace-nowrap max-w-[120px]">
                              ID: {b.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                            {(b.guestName || b.guestEmail || 'G').charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[100px]">
                              {b.guestName || 'Guest'}
                            </p>
                            <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[100px] sm:max-w-[150px]">
                              {b.guestEmail || ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap max-w-[140px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600 flex items-center justify-center">📅</span>
                          </div>
                          <span className="text-xs sm:text-sm text-gray-800 font-medium truncate whitespace-nowrap block">
                            {b.checkIn?.seconds
                              ? new Date(b.checkIn.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : b.checkIn ? new Date(b.checkIn).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div className="flex items-center gap-2 flex-nowrap whitespace-nowrap max-w-[140px]">
                          <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                            <span className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-600 flex items-center justify-center">📅</span>
                          </div>
                          <span className="text-xs sm:text-sm text-gray-800 font-medium truncate whitespace-nowrap block">
                            {b.checkOut?.seconds
                              ? new Date(b.checkOut.seconds * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                              : b.checkOut ? new Date(b.checkOut).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : 'N/A'}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                        <div>
                          <p className="font-bold text-gray-800 text-sm sm:text-base">
                            ₱{(b.finalPrice || b.price || 0).toLocaleString()}.00
                          </p>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Best Reviewed Bookings Section - Redesigned */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-green-500/10">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
              </div>
              <span>Best Reviewed Bookings</span>
            </h3>
            <button
              onClick={() => setPdfPreview({ open: true, type: 'bestReviews' })}
              className="group relative bg-gradient-to-r from-green-500 to-green-400 via-green-600 to-green-500 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-green-400 focus:outline-none focus:ring-2 focus:ring-green-300"
              style={{ minWidth: 140 }}
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </span>
              <span className="tracking-wide">Export Best Reviews</span>
              <span className="absolute -top-2 -right-2 bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
            </button>
            {/* PDF Preview Modal for Best Reviews */}
            {pdfPreview.open && pdfPreview.type === 'bestReviews' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
                    <h3 className="text-lg sm:text-xl font-semibold text-green-600 flex items-center gap-2">
                      <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-green-500 mr-1" />
                      Best Reviewed Bookings Preview
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
                    <table className="w-full text-xs sm:text-sm border border-green-200 rounded-lg">
                      <thead className="bg-gradient-to-r from-green-50 to-green-100 border-b-2 border-green-200">
                        <tr>
                          <th className="px-2 py-2 text-left font-bold text-green-700">Property</th>
                          <th className="px-2 py-2 text-left font-bold text-green-700">Guest</th>
                          <th className="px-2 py-2 text-left font-bold text-green-700">Email</th>
                          <th className="px-2 py-2 text-left font-bold text-green-700">Rating</th>
                          <th className="px-2 py-2 text-left font-bold text-green-700">Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviews.filter(r => typeof r.rating === 'number').sort((a, b) => b.rating - a.rating).slice(0, 5).length === 0 ? (
                          <tr><td colSpan={5} className="text-center text-gray-400 py-4">No reviews found.</td></tr>
                        ) : (
                          reviews.filter(r => typeof r.rating === 'number').sort((a, b) => b.rating - a.rating).slice(0, 5).map((r) => (
                            <tr key={r.id} className="border-b border-green-50">
                              <td className="px-2 py-2">{r.listingName || r.listingTitle || '—'}</td>
                              <td className="px-2 py-2">{r.name || 'Guest'}</td>
                              <td className="px-2 py-2">{r.email || ''}</td>
                              <td className="px-2 py-2">{r.rating}</td>
                              <td className="px-2 py-2">{r.comment || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2 border-t border-gray-100">
                    <button
                      className="bg-green-500 hover:bg-green-600 text-white font-bold px-6 py-2 rounded-lg shadow transition"
                      onClick={() => { exportBestReviewsPDF(); setPdfPreview({ open: false, type: null }); }}
                      disabled={reviews.filter(r => typeof r.rating === 'number').sort((a, b) => b.rating - a.rating).slice(0, 5).length === 0}
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
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md overflow-x-auto w-full max-w-full">
            {loadingData ? (
              <p className="text-green-400 p-6">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-green-400 p-6">No reviews found.</p>
            ) : (
              <table className="w-full max-w-full text-xs sm:text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-green-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Property</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rating</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviews
                    .filter(r => typeof r.rating === 'number')
                    .sort((a, b) => b.rating - a.rating)
                    .slice(0, 5)
                    .map((r) => {
                      const img = (r.listingId && listingImageMap[r.listingId]) || "/default-listing.png";
                      return (
                        <tr key={r.id} className="hover:bg-green-50/30 transition-all duration-200">
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="relative">
                                <img
                                  src={img}
                                  alt={r.listingName || r.listingTitle}
                                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl object-cover ring-2 ring-gray-100"
                                />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[120px]">
                                  {r.listingName || r.listingTitle || '—'}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate whitespace-nowrap max-w-[120px]">
                                  ID: {r.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                {(r.name || r.email || 'G').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[100px]">
                                  {r.name || 'Guest'}
                                </p>
                                <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[100px] sm:max-w-[150px]">
                                  {r.email || ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold shadow-sm bg-gradient-to-r from-green-500 to-green-600 text-white">
                              {r.rating} <span className="ml-1 text-yellow-300">★</span>
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 max-w-xs truncate">
                            <div className="flex items-center gap-2">
                              <span className="truncate block whitespace-nowrap max-w-[120px] sm:max-w-[180px] md:max-w-[220px]">
                                {r.comment || '—'}
                              </span>
                              {r.comment && r.comment.length > 40 && (
                                <button
                                  className="ml-1 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold shadow-sm hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition"
                                  onClick={() => setCommentModal({ open: true, comment: r.comment, guest: r.name || r.email || 'Guest', property: r.listingName || r.listingTitle || 'Property' })}
                                  type="button"
                                >
                                  VIEW ALL
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Lowest Reviewed Bookings Section - Redesigned */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-red-500/10">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
              </div>
              <span>Lowest Reviewed Bookings</span>
            </h3>
            <button
              onClick={() => setPdfPreview({ open: true, type: 'lowestReviews' })}
              className="group relative bg-gradient-to-r from-red-500 to-red-400 via-red-600 to-red-500 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-red-400 focus:outline-none focus:ring-2 focus:ring-red-300"
              style={{ minWidth: 140 }}
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </span>
              <span className="tracking-wide">Export Lowest Reviews</span>
              <span className="absolute -top-2 -right-2 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
            </button>
            {/* PDF Preview Modal for Lowest Reviews */}
            {pdfPreview.open && pdfPreview.type === 'lowestReviews' && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
                    <h3 className="text-lg sm:text-xl font-semibold text-red-600 flex items-center gap-2">
                      <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-red-500 mr-1" />
                      Lowest Reviewed Bookings Preview
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
                    <table className="w-full text-xs sm:text-sm border border-red-200 rounded-lg">
                      <thead className="bg-gradient-to-r from-red-50 to-red-100 border-b-2 border-red-200">
                        <tr>
                          <th className="px-2 py-2 text-left font-bold text-red-700">Property</th>
                          <th className="px-2 py-2 text-left font-bold text-red-700">Guest</th>
                          <th className="px-2 py-2 text-left font-bold text-red-700">Email</th>
                          <th className="px-2 py-2 text-left font-bold text-red-700">Rating</th>
                          <th className="px-2 py-2 text-left font-bold text-red-700">Comment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reviews.filter(r => typeof r.rating === 'number').sort((a, b) => a.rating - b.rating).slice(0, 5).length === 0 ? (
                          <tr><td colSpan={5} className="text-center text-gray-400 py-4">No reviews found.</td></tr>
                        ) : (
                          reviews.filter(r => typeof r.rating === 'number').sort((a, b) => a.rating - b.rating).slice(0, 5).map((r) => (
                            <tr key={r.id} className="border-b border-red-50">
                              <td className="px-2 py-2">{r.listingName || r.listingTitle || '—'}</td>
                              <td className="px-2 py-2">{r.name || 'Guest'}</td>
                              <td className="px-2 py-2">{r.email || ''}</td>
                              <td className="px-2 py-2">{r.rating}</td>
                              <td className="px-2 py-2">{r.comment || '—'}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2 border-t border-gray-100">
                    <button
                      className="bg-red-500 hover:bg-red-600 text-white font-bold px-6 py-2 rounded-lg shadow transition"
                      onClick={() => { exportLowestReviewsPDF(); setPdfPreview({ open: false, type: null }); }}
                      disabled={reviews.filter(r => typeof r.rating === 'number').sort((a, b) => a.rating - b.rating).slice(0, 5).length === 0}
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
          <div className="bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-md overflow-x-auto w-full max-w-full">
            {loadingData ? (
              <p className="text-red-400 p-6">Loading reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-red-400 p-6">No reviews found.</p>
            ) : (
              <table className="w-full max-w-full text-xs sm:text-sm">
                <thead className="bg-gradient-to-r from-gray-50 to-gray-100 border-b-2 border-red-200">
                  <tr>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Property</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Guest</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Rating</th>
                    <th className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Comment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {reviews
                    .filter(r => typeof r.rating === 'number')
                    .sort((a, b) => a.rating - b.rating)
                    .slice(0, 5)
                    .map((r) => {
                      const img = (r.listingId && listingImageMap[r.listingId]) || "/default-listing.png";
                      return (
                        <tr key={r.id} className="hover:bg-red-50/30 transition-all duration-200">
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2 sm:gap-3">
                              <div className="relative">
                                <img
                                  src={img}
                                  alt={r.listingName || r.listingTitle}
                                  className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-lg sm:rounded-xl object-cover ring-2 ring-gray-100"
                                />
                                <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-black/20 to-transparent"></div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[120px]">
                                  {r.listingName || r.listingTitle || '—'}
                                </p>
                                <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5 truncate whitespace-nowrap max-w-[120px]">
                                  ID: {r.id}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center text-white font-bold text-xs">
                                {(r.name || r.email || 'G').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-gray-800 text-xs sm:text-sm truncate whitespace-nowrap max-w-[100px]">
                                  {r.name || 'Guest'}
                                </p>
                                <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[100px] sm:max-w-[150px]">
                                  {r.email || ''}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4">
                            <span className="inline-flex items-center px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs font-bold shadow-sm bg-gradient-to-r from-red-500 to-red-600 text-white">
                              {r.rating} <span className="ml-1 text-yellow-300">★</span>
                            </span>
                          </td>
                          <td className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 max-w-xs truncate">
                            <div className="flex items-center gap-2">
                              <span className="truncate block whitespace-nowrap max-w-[120px] sm:max-w-[180px] md:max-w-[220px]">
                                {r.comment || '—'}
                              </span>
                              {r.comment && r.comment.length > 40 && (
                                <button
                                  className="ml-1 px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs font-semibold shadow-sm hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1 transition"
                                  onClick={() => setCommentModal({ open: true, comment: r.comment, guest: r.name || r.email || 'Guest', property: r.listingName || r.listingTitle || 'Property' })}
                                  type="button"
                                >
                                  VIEW ALL
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </main>
      {/* Comment Modal */}
      {commentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
              <h3 className="text-lg sm:text-xl font-semibold text-[#23364A] flex items-center gap-2">
                <FileText className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 mr-1" />
                Review Comment
              </h3>
              <button
                className="p-2 rounded-full hover:bg-gray-100 transition"
                onClick={() => setCommentModal({ open: false, comment: '', guest: '', property: '' })}
                aria-label="Close"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-4 sm:px-6 pt-3 pb-2">
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-500">Guest:</span>
                <span className="text-xs sm:text-sm font-semibold text-blue-700 break-all">{commentModal.guest}</span>
                <span className="hidden sm:inline text-gray-300">|</span>
                <span className="text-xs font-medium text-gray-500">Property:</span>
                <span className="text-xs sm:text-sm font-semibold text-green-700 break-all">{commentModal.property}</span>
              </div>
            </div>
            <div className="px-4 sm:px-6 pb-6 flex-1 overflow-y-auto">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 sm:p-4 text-gray-900 whitespace-pre-line text-sm sm:text-base shadow-inner break-words min-h-[60px]">
                {commentModal.comment}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;

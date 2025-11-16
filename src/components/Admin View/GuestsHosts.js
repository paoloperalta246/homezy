import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, orderBy, query, where, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "../Host View/images/homezy-logo.png";
import { LayoutDashboard, Users, DollarSign, FileText, Shield, Settings, LogOut, User, Book } from "lucide-react";

const GuestsHosts = () => {
  const [admin, setAdmin] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [hosts, setHosts] = useState([]);
  const [guests, setGuests] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [guestToDelete, setGuestToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteSuccess, setDeleteSuccess] = useState("");
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;

// PDF Export helpers (Professional look, no logo)
  const addPDFHeader = (doc, title, accentColor = [59, 130, 246]) => {
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

  const addPDFFooter = (doc, accentColor = [59, 130, 246]) => {
    const pageCount = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(...accentColor);
      doc.text(`Generated: ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
        105, 292, { align: 'center' });
    }
  };


  // Export Hosts Only
  const exportHostsPDF = () => {
    if (!hosts.length) return;
    const doc = new jsPDF();
    addPDFHeader(doc, "Hosts", [139, 92, 246]);
    autoTable(doc, {
      startY: 34,
      head: [["Name", "Email", "Plan", "Phone", "Status"]],
      body: hosts.map(h => [
        h.fullName || '',
        h.email || '',
        h.subscriptionPlan ? (h.subscriptionPlan.charAt(0).toUpperCase() + h.subscriptionPlan.slice(1)) : '-',
        h.phone || '-',
        h.verified ? 'Verified' : 'Unverified',
      ]),
      styles: { fontSize: 11, cellPadding: 4, lineColor: [139, 92, 246], lineWidth: 0.2 },
      headStyles: { fillColor: [139, 92, 246], textColor: 255, fontStyle: 'bold', fontSize: 12 },
      alternateRowStyles: { fillColor: [237, 233, 254] },
      tableLineColor: [139, 92, 246],
      tableLineWidth: 0.2,
      margin: { left: 10, right: 10 },
      didDrawPage: (data) => {},
    });
    addPDFFooter(doc, [139, 92, 246]);
    doc.save(`hosts_${Date.now()}.pdf`);
  };

  // Export Guests Only
  const exportGuestsPDF = () => {
    if (!guests.length) return;
    const doc = new jsPDF();
    addPDFHeader(doc, "Guests", [251, 146, 60]);
    autoTable(doc, {
      startY: 34,
      head: [["Name", "Email", "Phone", "Status"]],
      body: guests.map(g => [
        g.fullName || '',
        g.email || '',
        g.phone || '-',
        g.verified ? 'Verified' : 'Unverified',
      ]),
      styles: { fontSize: 11, cellPadding: 4, lineColor: [251, 146, 60], lineWidth: 0.2 },
      headStyles: { fillColor: [251, 146, 60], textColor: 255, fontStyle: 'bold', fontSize: 12 },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      tableLineColor: [251, 146, 60],
      tableLineWidth: 0.2,
      margin: { left: 10, right: 10 },
      didDrawPage: (data) => {},
    });
    addPDFFooter(doc, [251, 146, 60]);
    doc.save(`guests_${Date.now()}.pdf`);
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
      } catch (e) {
        console.error("Failed to fetch hosts or guests", e);
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
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${
          disabled
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
              <span className="mt-1 px-2 py-[2px] rounded-full bg-gradient-to-r from-orange-500 to-pink-500 text-white text-[10px] font-bold shadow border border-white/70 align-middle tracking-wider" style={{letterSpacing: '0.5px', maxWidth: '70px', whiteSpace: 'nowrap'}}>Admin</span>
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
              <Users className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7" />
            </span>
            Guests & Hosts
          </h2>
          <p className="text-[#5E6282] text-sm sm:text-base md:text-lg mb-6 sm:mb-8">
            View detailed information about all guests and hosts.
          </p>

        </div>
        {/* Hosts Table - Modern UI */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <User className="w-5 h-5 text-purple-600" /> Hosts
            </h3>
            <button
              onClick={exportHostsPDF}
              className="group bg-gradient-to-r from-purple-500 to-purple-400 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-300 relative"
              style={{ minWidth: 160 }}
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </span>
              <span className="tracking-wide">Export Hosts PDF</span>
              <span className="absolute -top-2 -right-2 bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
            </button>
          </div>
          {/* Table wrapper is horizontally scrollable, cards are not */}
          <div className="bg-white border border-purple-100 rounded-2xl shadow-xl">
            {loadingData ? (
              <p className="p-8 text-purple-400 text-center text-lg font-semibold">Loading hosts...</p>
            ) : hosts.length === 0 ? (
              <p className="p-8 text-purple-400 text-center text-lg font-semibold">No hosts found.</p>
            ) : (
              <>
                {/* Desktop Table - horizontally scrollable */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] hidden sm:table">
                  <thead className="bg-gradient-to-r from-purple-100 via-purple-50 to-white border-b-2 border-purple-200">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Photo</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Plan</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-50">
                    {hosts.map(h => (
                      <tr key={h.id} className="hover:bg-purple-50/60 transition-all group">
                        <td className="px-6 py-4">
                          {h.photoURL ? (
                            <img src={h.photoURL} alt={h.fullName} className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 shadow group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xl border-2 border-purple-200 shadow group-hover:scale-105 transition-transform">
                              {h.fullName ? h.fullName.charAt(0).toUpperCase() : "?"}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900 text-base">{h.fullName}</td>
                        <td className="px-6 py-4 text-gray-700 text-sm">{h.email}</td>
                        <td className="px-6 py-4 text-gray-700 text-sm">
                          {h.subscriptionPlan ? (
                            <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs shadow-sm border border-purple-200">
                              {h.subscriptionPlan.charAt(0).toUpperCase() + h.subscriptionPlan.slice(1)}
                            </span>
                          ) : (
                            <span className="inline-block px-3 py-1 rounded-full bg-gray-100 text-gray-400 text-xs font-semibold border border-gray-200">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-700 text-sm">{h.phone || "-"}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${h.verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {h.verified ? "Verified" : "Unverified"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {/* Mobile stacked cards */}
                <div className="flex flex-col gap-3 sm:hidden p-1">
                  {hosts.map(h => (
                    <div key={h.id} className="bg-white border border-purple-100 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-3 mb-1">
                        {h.photoURL ? (
                          <img src={h.photoURL} alt={h.fullName} className="w-12 h-12 rounded-full object-cover border-2 border-purple-200 shadow" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xl border-2 border-purple-200 shadow">
                            {h.fullName ? h.fullName.charAt(0).toUpperCase() : "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900 text-base truncate whitespace-nowrap max-w-[160px]">{h.fullName}</p>
                          <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[160px]">{h.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                        <span className="font-semibold">Plan:</span> {h.subscriptionPlan ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-semibold text-xs shadow-sm border border-purple-200">
                            {h.subscriptionPlan.charAt(0).toUpperCase() + h.subscriptionPlan.slice(1)}
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 text-xs font-semibold border border-gray-200">-</span>
                        )}
                        <span className="font-semibold ml-2">Phone:</span> {h.phone || "-"}
                        <span className="font-semibold ml-2">Status:</span> <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold shadow-sm ${h.verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{h.verified ? "Verified" : "Unverified"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Guests Table - Modern UI */}
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Users className="w-5 h-5 text-orange-600" /> Guests
            </h3>
            <button
              onClick={exportGuestsPDF}
              className="group bg-gradient-to-r from-orange-500 to-orange-400 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 relative"
              style={{ minWidth: 160 }}
            >
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
              </span>
              <span className="tracking-wide">Export Guests PDF</span>
              <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
            </button>
          </div>
          {/* Table wrapper is horizontally scrollable, cards are not */}
          <div className="bg-white border border-orange-100 rounded-2xl shadow-xl">
            {loadingData ? (
              <p className="p-8 text-orange-400 text-center text-lg font-semibold">Loading guests...</p>
            ) : guests.length === 0 ? (
              <p className="p-8 text-orange-400 text-center text-lg font-semibold">No guests found.</p>
            ) : (
              <>
                {/* Desktop Table - horizontally scrollable */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[700px] hidden sm:table">
                  <thead className="bg-gradient-to-r from-orange-100 via-orange-50 to-white border-b-2 border-orange-200">
                      <tr>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Photo</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Name</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Email</th>
                      <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Phone</th>
                      <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-orange-50">
                    {guests.map(g => (
                      <tr key={g.id} className="hover:bg-orange-50/60 transition-all group">
                        <td className="px-6 py-4">
                          {g.photoURL ? (
                            <img src={g.photoURL} alt={g.fullName} className="w-12 h-12 rounded-full object-cover border-2 border-orange-200 shadow group-hover:scale-105 transition-transform" />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xl border-2 border-orange-200 shadow group-hover:scale-105 transition-transform">
                              {g.fullName ? g.fullName.charAt(0).toUpperCase() : "?"}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900 text-base">{g.fullName}</td>
                        <td className="px-6 py-4 text-gray-700 text-sm">{g.email}</td>
                        <td className="px-6 py-4 text-gray-700 text-sm">{g.phone || "-"}</td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-bold shadow-sm ${g.verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {g.verified ? "Verified" : "Unverified"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {/* Mobile stacked cards */}
                <div className="flex flex-col gap-3 sm:hidden p-1">
                  {guests.map(g => (
                    <div key={g.id} className="bg-white border border-orange-100 rounded-xl shadow-sm p-4 flex flex-col gap-2">
                      <div className="flex items-center gap-3 mb-1">
                        {g.photoURL ? (
                          <img src={g.photoURL} alt={g.fullName} className="w-12 h-12 rounded-full object-cover border-2 border-orange-200 shadow" />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white font-bold text-xl border-2 border-orange-200 shadow">
                            {g.fullName ? g.fullName.charAt(0).toUpperCase() : "?"}
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-gray-900 text-base truncate whitespace-nowrap max-w-[160px]">{g.fullName}</p>
                          <p className="text-xs text-gray-500 truncate whitespace-nowrap max-w-[160px]">{g.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-gray-700">
                        <span className="font-semibold">Phone:</span> {g.phone || "-"}
                        <span className="font-semibold ml-2">Status:</span> <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-bold shadow-sm ${g.verified ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{g.verified ? "Verified" : "Unverified"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Delete Guest Modal removed */}
    </div>
  );
};

export default GuestsHosts;

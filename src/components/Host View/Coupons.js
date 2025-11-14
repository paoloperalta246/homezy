import React, { useState, useEffect, useRef } from "react";
import { DateRange } from "react-date-range";
import { enUS } from 'date-fns/locale';
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut, updateEmail } from "firebase/auth";
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  serverTimestamp,
  deleteDoc,
  addDoc,
} from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png";
import { Home, Clipboard, User, Gift, MessageSquare, Calendar, Ticket, CheckCircle, XCircle, Clock, Trash2, Copy, Filter, Activity, DollarSign, Plus, X, Bell, LogOut } from "lucide-react";

const Coupons = () => {
  const [host, setHost] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [profilePicFile, setProfilePicFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showUsage, setShowUsage] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'percentage',
    discountValue: '',
    maxUses: 1,
    dateRange: {
      startDate: null,
      endDate: null,
      key: 'selection',
    },
  });
  const [calendarOpen, setCalendarOpen] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  const [mobileOpen, setMobileOpen] = useState(false);

  // Fetch logged-in host data
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const docRef = doc(db, "hosts", user.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) setHost(docSnap.data());
        else console.log("No host data found");

          // Fetch coupons for this host
          fetchCoupons(user.uid);
      } else setHost(null);
    });

    return () => unsubscribe();
  }, []);

    const fetchCoupons = async (userId) => {
      setLoading(true);
      try {
        const q = query(collection(db, 'coupons'), where('hostId', '==', userId));
        const snapshot = await getDocs(q);
        const couponList = snapshot.docs.map(d => {
          const data = d.data();
          const expiresAt = data.expiresAt?.toDate ? data.expiresAt.toDate() : data.expiresAt ? new Date(data.expiresAt) : null;
          const isExpired = expiresAt && expiresAt < new Date();
        
          return {
            id: d.id,
            ...data,
            expiresAt,
            isExpired,
            displayStatus: isExpired ? 'expired' : (data.usedCount >= data.maxUses ? 'used' : data.status)
          };
        });
        couponList.sort((a, b) => {
          const aDate = a.createdAt?.seconds || 0;
          const bDate = b.createdAt?.seconds || 0;
          return bDate - aDate;
        });
        setCoupons(couponList);
      } catch (e) {
        console.error('Failed to fetch coupons:', e);
      } finally {
        setLoading(false);
      }
    };

    const handleToggleStatus = async (couponId, currentStatus) => {
      try {
        const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
        await updateDoc(doc(db, 'coupons', couponId), { status: newStatus });
        setCoupons(coupons.map(c => c.id === couponId ? { ...c, status: newStatus, displayStatus: c.isExpired ? 'expired' : newStatus } : c));
      } catch (e) {
        alert('Failed to update coupon status');
      }
    };

    const handleDeleteCoupon = async (couponId) => {
      if (!window.confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) return;
      try {
        await deleteDoc(doc(db, 'coupons', couponId));
        setCoupons(coupons.filter(c => c.id !== couponId));
        alert('Coupon deleted successfully');
      } catch (e) {
        alert('Failed to delete coupon');
      }
    };

    const handleCopyCode = (code) => {
      navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    };

    const generateCouponCode = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    const handleCreateCoupon = async () => {
      if (!auth.currentUser) return;
      
      // Validation
      if (!newCoupon.code.trim()) {
        alert('Please enter a coupon code');
        return;
      }
      if (!newCoupon.discountValue || parseFloat(newCoupon.discountValue) <= 0) {
        alert('Please enter a valid discount value');
        return;
      }
      if (newCoupon.discountType === 'percentage' && parseFloat(newCoupon.discountValue) > 100) {
        alert('Percentage discount cannot exceed 100%');
        return;
      }

      if (!newCoupon.dateRange.endDate) {
        alert('Please pick an expiration date.');
        return;
      }

      setCreating(true);
      try {
        const couponData = {
          code: newCoupon.code.toUpperCase().trim(),
          discountType: newCoupon.discountType,
          discountValue: parseFloat(newCoupon.discountValue),
          maxUses: parseInt(newCoupon.maxUses),
          usedCount: 0,
          status: 'active',
          hostId: auth.currentUser.uid,
          createdAt: serverTimestamp(),
          validFrom: newCoupon.dateRange.startDate ? new Date(newCoupon.dateRange.startDate) : null,
          expiresAt: newCoupon.dateRange.endDate ? new Date(newCoupon.dateRange.endDate) : null,
        };

        await addDoc(collection(db, 'coupons'), couponData);
        alert('Coupon created successfully!');
        setShowCreateModal(false);
        setNewCoupon({
          code: '',
          discountType: 'percentage',
          discountValue: '',
          maxUses: 1,
          dateRange: {
            startDate: null,
            endDate: null,
            key: 'selection',
          },
        });
        fetchCoupons(auth.currentUser.uid);
      } catch (e) {
        console.error(e);
        alert('Failed to create coupon. The code might already exist.');
      } finally {
        setCreating(false);
      }
    };

    const filteredCoupons = coupons.filter(c => {
      if (filterStatus === 'all') return true;
      return c.displayStatus === filterStatus;
    });

    const getStatusBadge = (status) => {
      if (status === 'active') return <span className="flex items-center gap-1 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold"><CheckCircle className="w-3 h-3" />Active</span>;
      if (status === 'expired') return <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold"><Clock className="w-3 h-3" />Expired</span>;
      if (status === 'used') return <span className="flex items-center gap-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold"><Activity className="w-3 h-3" />Used</span>;
      return <span className="flex items-center gap-1 px-3 py-1 bg-red-100 text-red-700 rounded-full text-xs font-semibold"><XCircle className="w-3 h-3" />Inactive</span>;
    };
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

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async () => {
    if (!profilePicFile) return host?.photoURL || "";
    const formData = new FormData();
    formData.append("file", profilePicFile);
    formData.append("upload_preset", "homezy_unsigned");

    const res = await fetch(
      "https://api.cloudinary.com/v1_1/dnpimmfrn/image/upload",
      { method: "POST", body: formData }
    );
    const data = await res.json();
    return data.secure_url;
  };

  // ✅ Update all listings hostName
  const updateListingsHostName = async (newFirstName) => {
    try {
      const listingsRef = collection(db, "listings");
      const q = query(listingsRef, where("hostId", "==", auth.currentUser.uid));
      const querySnapshot = await getDocs(q);

      const updatePromises = querySnapshot.docs.map((docSnap) => {
        const docRef = doc(db, "listings", docSnap.id);
        return updateDoc(docRef, { hostName: newFirstName });
      });

      await Promise.all(updatePromises);
      console.log("All listings updated with new hostName!");
    } catch (error) {
      console.error("Error updating listings:", error);
    }
  };

  // Save profile changes
  const handleSaveChanges = async () => {
    if (!host) return;
    setSaving(true);

    try {
      let updatedData = { ...host };

      // Upload new profile picture if changed
      if (profilePicFile) {
        const imageUrl = await uploadImageToCloudinary();
        updatedData.photoURL = imageUrl;
      }

      // Update Firestore host doc
      const docRef = doc(db, "hosts", auth.currentUser.uid);
      updatedData.timestamp = serverTimestamp();
      await updateDoc(docRef, updatedData);

      // Update email in Firebase Auth if changed
      if (host.email !== updatedData.email) {
        await updateEmail(auth.currentUser, updatedData.email);
      }

      // ✅ Update all listings hostName
      await updateListingsHostName(updatedData.firstName);

      alert("Profile updated successfully!");
    } catch (err) {
      console.error(err);
      alert("Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setDropdownOpen(false);
    navigate("/login");
  };

  const getNavItem = (path, label, Icon) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => navigate(path)}
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${isActive ? "bg-[#FF5A1F] text-white" : "text-[#23364A] hover:bg-gray-100"
          }`}
      >
        {Icon && <Icon className="w-5 h-5 text-current" />}
        <span className={`${isActive ? "text-white" : "text-[#23364A]"}`}>{label}</span>
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
      <main className="flex-1 px-4 sm:px-8 md:px-16 py-10 md:ml-[260px]">
          <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div>
              <h2 className="text-2xl sm:text-[32px] font-bold mb-2 flex items-center gap-2">
                <span className="p-2 rounded-xl bg-orange-500/10 text-orange-600">
                  <Ticket className="w-7 h-7" />
                </span>
                Coupons
              </h2>
              <p className="text-[#5E6282] text-base sm:text-lg">
                Create and manage discount coupons for your guests. No points required!
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition whitespace-nowrap justify-center sm:justify-start"
            >
              <Plus className="w-5 h-5" />
              Create Coupon
            </button>
          </div>
        </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Filter className="w-4 h-4" />
              <span className="font-medium">Filter:</span>
            </div>
            {['all', 'active', 'inactive', 'used', 'expired'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                  filterStatus === status
                    ? 'bg-orange-500 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
            <button
              onClick={() => setShowUsage(v => !v)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${showUsage ? 'bg-indigo-500 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >{showUsage ? 'Hide Usage' : 'Show Usage'}</button>
          </div>

          {/* Coupon List */}
          {loading ? (
            <p className="text-center text-gray-500 py-12">Loading coupons...</p>
          ) : filteredCoupons.length === 0 ? (
            <div className="text-center py-16 px-4">
              <Ticket className="w-16 h-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">
                {filterStatus === 'all' ? 'No coupons yet' : `No ${filterStatus} coupons`}
              </h3>
              <p className="text-gray-500 mb-6">
                {filterStatus === 'all' 
                  ? 'Create your first coupon to offer discounts to your guests and increase bookings!'
                  : `You don't have any ${filterStatus} coupons at the moment.`
                }
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-orange-500 to-orange-400 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition flex items-center gap-2 mx-auto"
              >
                <Plus className="w-5 h-5" />
                Create Your First Coupon
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredCoupons.map(coupon => (
                <div
                  key={coupon.id}
                  className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Ticket className="w-5 h-5 text-orange-500" />
                        <h3 className="font-bold text-lg text-gray-800">{coupon.code}</h3>
                      </div>
                      <p className="text-sm text-gray-600">
                        {coupon.discountType === 'percentage' 
                          ? `${coupon.discountValue}% Off` 
                          : `₱${coupon.discountValue} Off`
                        }
                      </p>
                    </div>
                    {getStatusBadge(coupon.displayStatus)}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 mb-4 text-sm text-gray-600">
                    <div className="flex items-center justify-between">
                      <span>Created:</span>
                      <span className="font-medium">
                        {coupon.createdAt?.seconds 
                          ? new Date(coupon.createdAt.seconds * 1000).toLocaleDateString()
                          : 'N/A'
                        }
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Expires:</span>
                      <span className={`font-medium ${coupon.isExpired ? 'text-red-600' : ''}`}>
                        {coupon.expiresAt 
                          ? coupon.expiresAt.toLocaleDateString()
                          : 'Never'
                        }
                      </span>
                    </div>
                    {showUsage && (
                      <div className="flex items-center justify-between">
                        <span>Usage:</span>
                        <span className="font-medium">
                          {coupon.usedCount || 0} / {coupon.maxUses || 1}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleCopyCode(coupon.code)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition"
                    >
                      <Copy className="w-4 h-4" />
                      {copiedCode === coupon.code ? 'Copied!' : 'Copy'}
                    </button>
                  
                    {!coupon.isExpired && coupon.displayStatus !== 'used' && (
                      <button
                        onClick={() => handleToggleStatus(coupon.id, coupon.status)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                          coupon.status === 'active'
                            ? 'bg-red-100 hover:bg-red-200 text-red-700'
                            : 'bg-green-100 hover:bg-green-200 text-green-700'
                        }`}
                      >
                        {coupon.status === 'active' ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  
                    <button
                      onClick={() => handleDeleteCoupon(coupon.id)}
                      className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg transition"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Create Coupon Modal */}
          {showCreateModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between rounded-t-3xl">
                  <h3 className="text-lg sm:text-2xl font-bold text-[#23364A] flex items-center gap-2">
                    <Ticket className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                    Create New Coupon
                  </h3>
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="p-2 sm:p-2.5 hover:bg-gray-100 rounded-full transition"
                  >
                    <X className="w-5 h-5 text-gray-600" />
                  </button>
                </div>

                <div className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                  {/* Coupon Code */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Coupon Code *
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCoupon.code}
                        onChange={(e) => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                        placeholder="e.g., SUMMER2024"
                        className="flex-1 px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm sm:text-base"
                        maxLength={20}
                      />
                      <button
                        onClick={() => setNewCoupon({...newCoupon, code: generateCouponCode()})}
                        className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition text-xs sm:text-sm"
                      >
                        Generate
                      </button>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1">Must be unique. Letters and numbers only.</p>
                  </div>

                  {/* Discount Type */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Discount Type *
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                      <button
                        onClick={() => setNewCoupon({...newCoupon, discountType: 'percentage'})}
                        className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition text-xs sm:text-sm ${
                          newCoupon.discountType === 'percentage'
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Percentage (%)
                      </button>
                      <button
                        onClick={() => setNewCoupon({...newCoupon, discountType: 'fixed'})}
                        className={`px-3 sm:px-4 py-2 sm:py-3 rounded-lg font-medium transition text-xs sm:text-sm ${
                          newCoupon.discountType === 'fixed'
                            ? 'bg-orange-500 text-white shadow-md'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Fixed Amount (₱)
                      </button>
                    </div>
                  </div>

                  {/* Discount Value */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Discount Value *
                    </label>
                    <div className="relative">
                      {newCoupon.discountType === 'fixed' && (
                        <span className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs sm:text-base">₱</span>
                      )}
                      <input
                        type="number"
                        value={newCoupon.discountValue}
                        onChange={(e) => setNewCoupon({...newCoupon, discountValue: e.target.value})}
                        placeholder={newCoupon.discountType === 'percentage' ? 'e.g., 20' : 'e.g., 500'}
                        className={`w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm sm:text-base ${
                          newCoupon.discountType === 'fixed' ? 'pl-7 sm:pl-8' : ''
                        }`}
                        min="0"
                        max={newCoupon.discountType === 'percentage' ? '100' : undefined}
                      />
                      {newCoupon.discountType === 'percentage' && (
                        <span className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-gray-500 text-xs sm:text-base">%</span>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                      {newCoupon.discountType === 'percentage' 
                        ? 'Enter a percentage between 1-100' 
                        : 'Enter the fixed discount amount in pesos'
                      }
                    </p>
                  </div>

                  {/* Max Uses */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Maximum Uses *
                    </label>
                    <input
                      type="number"
                      value={newCoupon.maxUses}
                      onChange={(e) => setNewCoupon({...newCoupon, maxUses: e.target.value})}
                      placeholder="e.g., 10"
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm sm:text-base"
                      min="1"
                    />
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1">How many times this coupon can be used total</p>
                  </div>

                  {/* Expiration Date (Required) */}
                  <div>
                    <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-2">
                      Pick an Expiration Date
                    </label>
                    <button
                      type="button"
                      onClick={() => setCalendarOpen((v) => !v)}
                      className="w-full px-3 sm:px-4 py-2 border border-gray-300 rounded-lg bg-white text-left focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none text-sm sm:text-base mb-2"
                    >
                      {newCoupon.dateRange.startDate && newCoupon.dateRange.endDate
                        ? `${new Date(newCoupon.dateRange.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} - ${new Date(newCoupon.dateRange.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`
                        : 'Pick an expiration date'}
                    </button>
                    {calendarOpen && (
                      <div className="z-50 relative">
                        <DateRange
                          editableDateInputs={true}
                          moveRangeOnFirstSelection={false}
                          onChange={item => setNewCoupon({
                            ...newCoupon,
                            dateRange: item.selection
                          })}
                          ranges={[newCoupon.dateRange]}
                          locale={enUS}
                          className="border border-gray-200 rounded-xl shadow-sm mx-auto w-full sm:w-auto"
                          direction="vertical"
                          minDate={new Date()}
                        />
                        <button
                          type="button"
                          className="mt-2 px-4 py-2 bg-gray-200 rounded-lg text-gray-700 hover:bg-gray-300"
                          onClick={() => setCalendarOpen(false)}
                        >Done</button>
                      </div>
                    )}
                    <p className="text-[10px] sm:text-xs text-gray-500 mt-1">This is required.</p>
                  </div>

                  {/* Info Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 sm:p-4">
                    <p className="text-xs sm:text-sm text-blue-800">
                      <strong>💡 Tip:</strong> Creating coupons is completely free! Use them to attract more guests and increase your bookings.
                    </p>
                  </div>
                </div>
                
                <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-4 sm:px-6 py-3 sm:py-4 rounded-b-3xl flex gap-2 sm:gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-xl transition text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCoupon}
                    disabled={creating}
                    className="flex-1 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white font-semibold rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base"
                  >
                    {creating ? 'Creating...' : 'Create Coupon'}
                  </button>
                </div>
              </div>
            </div>
          )}
      </main>

    </div>
  );
};

export default Coupons;

import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, query, where } from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "./images/homezy-logo.png";
import defaultProfile from "./images/default-profile.png";
import {
  Home, Clipboard, User, Gift, MessageSquare, Calendar,
  DollarSign, TrendingUp, AlertCircle, CreditCard, Wallet,
  PiggyBank, Banknote, CheckCircle, Ticket
} from "lucide-react";

const Earnings = () => {
  const [activeTab, setActiveTab] = useState("overview");
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [host, setHost] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname;
  
  // Payment method state
  const [paymentMethod, setPaymentMethod] = useState({
    type: "gcash", // gcash, paymaya, or paypal
    accountName: "",
    accountNumber: ""
  });

  // Earnings calculations - exclude cancelled bookings
  const activeBookings = bookings.filter(b => b.status !== 'cancelled');
  
  const totalEarnings = activeBookings.reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);
  const thisMonthEarnings = activeBookings
    .filter(b => {
      const bookingDate = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
      const now = new Date();
      return bookingDate.getMonth() === now.getMonth() && bookingDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);

  const thisYearEarnings = activeBookings
    .filter(b => {
      const bookingDate = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
      const now = new Date();
      return bookingDate.getFullYear() === now.getFullYear();
    })
    .reduce((sum, b) => sum + (b.finalPrice || b.price || 0), 0);

  const totalBookings = activeBookings.length;

  // Average earnings per booking
  const averageEarnings = totalBookings > 0 ? totalEarnings / totalBookings : 0;

  // Auth and data fetching
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(db, "hosts", user.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            setHost(docSnap.data());
          }
        } catch (err) {
          console.error("Error fetching host:", err);
        }

        // Fetch bookings
        try {
          const listingsSnapshot = await getDocs(
            query(collection(db, "listings"), where("hostId", "==", user.uid))
          );
          const listingIds = listingsSnapshot.docs.map((doc) => doc.id);

          if (listingIds.length > 0) {
            const bookingsSnapshot = await getDocs(collection(db, "bookings"));
            const allBookings = bookingsSnapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            }));

            const hostBookings = allBookings.filter((booking) =>
              listingIds.includes(booking.listingId)
            );

            setBookings(hostBookings);
          }
        } catch (err) {
          console.error("Error fetching bookings:", err);
        }
        finally {
          setLoading(false);
        }
      } else {
        setHost(null);
        setLoading(false);
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

  // Match Dashboard style: button-based nav with solid accent when active
  const handleNavigation = (path) => navigate(path);
  const getNavItem = (path, label, Icon) => {
    const isActive = currentPath === path;
    return (
      <button
        onClick={() => handleNavigation(path)}
        className={`flex items-center gap-3 px-6 py-3 font-medium transition rounded-md ${
          isActive ? "bg-[#FF5A1F] text-white" : "text-[#23364A] hover:bg-gray-100"
        }`}
      >
        {Icon && <Icon className="w-5 h-5 text-current" />}
        <span className={isActive ? "text-white" : "text-[#23364A]"}>{label}</span>
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans">
      {/* Mobile Hamburger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <button onClick={() => setMobileOpen(!mobileOpen)} className="p-2 bg-white rounded-md shadow-md">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-screen bg-[#F9FAFB] border-r border-gray-200 flex flex-col justify-between w-[260px] z-40 transition-transform duration-300 md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-[260px]'}`}>
        <div>
          <div className="flex items-center gap-2 px-6 py-6 pl-10 pt-10">
            <img src={homezyLogo} alt="Homezy Logo" className="w-11 h-11 object-contain" />
            <h1 className="text-[30px] font-bold text-[#23364A]">Homezy</h1>
          </div>
          <nav className="flex flex-col mt-4">
            {getNavItem('/dashboard','Dashboard',Home)}
            {getNavItem('/listings','My Listings',Clipboard)}
            {getNavItem('/host-messages','Messages',MessageSquare)}
            {getNavItem('/calendar','Calendar',Calendar)}
            {getNavItem('/points-rewards','Points & Rewards',Gift)}
            {getNavItem('/earnings','Earnings',DollarSign)}
          </nav>
        </div>
        {/* Profile + Logout (simplified) */}
        <div className="flex flex-col items-center gap-4 mb-6 relative px-4" ref={dropdownRef}>
          <button onClick={() => !host ? navigate('/login') : setDropdownOpen(!dropdownOpen)} className="flex items-center justify-center gap-2 bg-gray-200 text-gray-800 px-4 py-2 rounded-md font-medium hover:bg-gray-300 transition w-full">
            <img src={host?.photoURL || defaultProfile} alt="profile" className="w-6 h-6 rounded-full object-cover" />
            <span>{host?.firstName || 'Host'}</span>
          </button>
          {host && dropdownOpen && (
            <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-2xl shadow-xl ring-1 ring-gray-200 overflow-hidden z-50">
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <img src={host.photoURL || defaultProfile} alt="profile" className="w-10 h-10 rounded-full object-cover border border-gray-200" />
                  <div>
                    <p className="text-gray-800 font-semibold text-sm">{host.firstName || 'Host'}</p>
                    <p className="text-xs text-gray-500">{host.email || 'host@example.com'}</p>
                  </div>
                </div>
              </div>
              <div className="py-2 text-sm text-gray-700">
                <button onClick={() => { setDropdownOpen(false); navigate('/profile'); }} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left">
                  <User className="w-4 h-4 text-orange-500" /> Profile Settings
                </button>
                <button onClick={() => { setDropdownOpen(false); navigate('/host-bookings'); }} className="flex items-center gap-2 px-4 py-2 hover:bg-gray-50 transition-colors w-full text-left">
                  <Calendar className="w-4 h-4 text-orange-500" /> Bookings
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
          <button onClick={handleLogout} className="bg-[#B50000] text-white font-medium py-2 w-full rounded-md hover:opacity-90">Logout</button>
        </div>
      </aside>
      {mobileOpen && <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main Content */}
      <main className="flex-1 px-4 sm:px-8 md:px-16 py-6 md:py-10 md:ml-[260px]">
        {/* Page Heading */}
        <div className="mb-8">
          <h2 className="text-2xl sm:text-[28px] font-bold mb-1 flex items-center gap-2">Earnings Dashboard</h2>
          <p className="text-[#5E6282] text-base sm:text-lg">Track your earnings, view payment history, and manage payment methods.</p>
        </div>
        {/* Tab Switcher */}
        <div className="mb-8">
          <div className="inline-flex bg-gray-100 rounded-lg p-1 gap-1">
            <button 
              onClick={() => setActiveTab('overview')} 
              className={`px-6 py-2.5 rounded-md font-semibold transition-all ${
                activeTab === 'overview' 
                  ? 'bg-white text-[#FF5A1F] shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Overview
            </button>
            <button 
              onClick={() => setActiveTab('history')} 
              className={`px-6 py-2.5 rounded-md font-semibold transition-all ${
                activeTab === 'history' 
                  ? 'bg-white text-[#FF5A1F] shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Payment History
            </button>
            <button 
              onClick={() => setActiveTab('payment-method')} 
              className={`px-6 py-2.5 rounded-md font-semibold transition-all ${
                activeTab === 'payment-method' 
                  ? 'bg-white text-[#FF5A1F] shadow-md' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Payment Method
            </button>
          </div>
        </div>
        <div className="min-h-[300px]">
          {/* Existing content area retained below */}
          <div className="flex-1 overflow-y-auto p-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading earnings data...</p>
              </div>
            </div>
          ) : (
            <>
              {/* Overview Tab */}
              {activeTab === "overview" && (
                <div className="space-y-8">
                  {/* Stats Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                    <div className="bg-white border-2 border-green-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-green-100 p-3 rounded-lg">
                          <DollarSign className="w-6 h-6 text-green-600" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">Total Earnings</p>
                      <p className="text-2xl font-bold text-gray-900">₱{totalEarnings.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">All time</p>
                    </div>

                    <div className="bg-white border-2 border-blue-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-blue-100 p-3 rounded-lg">
                          <Calendar className="w-6 h-6 text-blue-600" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">This Month</p>
                      <p className="text-2xl font-bold text-gray-900">₱{thisMonthEarnings.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}</p>
                    </div>

                    <div className="bg-white border-2 border-purple-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-purple-100 p-3 rounded-lg">
                          <TrendingUp className="w-6 h-6 text-purple-600" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">This Year</p>
                      <p className="text-2xl font-bold text-gray-900">₱{thisYearEarnings.toLocaleString()}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date().getFullYear()}</p>
                    </div>

                    <div className="bg-white border-2 border-orange-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-orange-100 p-3 rounded-lg">
                          <Clipboard className="w-6 h-6 text-orange-600" />
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-1">Total Bookings</p>
                      <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
                      <p className="text-xs text-gray-500 mt-1">Completed</p>
                    </div>

                    <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-6 text-white shadow-lg hover:shadow-xl transition-shadow">
                      <div className="flex items-center justify-between mb-3">
                        <div className="bg-white/20 p-3 rounded-lg">
                          <PiggyBank className="w-6 h-6" />
                        </div>
                        <TrendingUp className="w-5 h-5 opacity-80" />
                      </div>
                      <p className="text-sm opacity-90 mb-1">Available Balance</p>
                      <p className="text-2xl font-bold">₱{availableBalance.toLocaleString()}</p>
                      <p className="text-xs opacity-75 mt-1">Ready to withdraw</p>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <div className="w-1 h-5 bg-orange-500 rounded"></div>
                      Quick Actions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <button
                        onClick={() => setActiveTab("withdrawals")}
                        className="flex items-center gap-4 p-4 border-2 border-orange-200 rounded-lg hover:bg-orange-50 hover:border-orange-400 transition-all group"
                      >
                        <div className="bg-orange-100 p-3 rounded-lg group-hover:bg-orange-200 transition">
                          <PiggyBank className="w-6 h-6 text-orange-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800">Withdraw Funds</p>
                          <p className="text-xs text-gray-600">Request a payout</p>
                        </div>
                      </button>
                      <button
                        onClick={() => setActiveTab("history")}
                        className="flex items-center gap-4 p-4 border-2 border-blue-200 rounded-lg hover:bg-blue-50 hover:border-blue-400 transition-all group"
                      >
                        <div className="bg-blue-100 p-3 rounded-lg group-hover:bg-blue-200 transition">
                          <Banknote className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800">View History</p>
                          <p className="text-xs text-gray-600">All transactions</p>
                        </div>
                      </button>
                      <button
                        onClick={() => navigate("/dashboard")}
                        className="flex items-center gap-4 p-4 border-2 border-purple-200 rounded-lg hover:bg-purple-50 hover:border-purple-400 transition-all group"
                      >
                        <div className="bg-purple-100 p-3 rounded-lg group-hover:bg-purple-200 transition">
                          <Home className="w-6 h-6 text-purple-600" />
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-gray-800">Dashboard</p>
                          <p className="text-xs text-gray-600">View analytics</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Recent Activity Summary */}
                  <div className="bg-blue-50 border-l-4 border-blue-400 p-5 rounded-r-lg">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold text-blue-900">Direct PayPal Withdrawals</p>
                        <p className="text-sm text-blue-800 mt-1">
                          Withdrawals are processed instantly through PayPal. Click "Withdraw Now" to transfer funds directly to your PayPal account.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Withdrawals Tab */}
              {activeTab === "withdrawals" && (
                <div className="space-y-6">
                  {/* Balance Card */}
                  <div className="bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl p-8 text-white shadow-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm opacity-90 mb-2">Available Balance</p>
                        <p className="text-4xl font-bold">₱{availableBalance.toLocaleString()}</p>
                      </div>
                      <div className="bg-white/20 p-4 rounded-full">
                        <PiggyBank className="w-10 h-10" />
                      </div>
                    </div>
                  </div>

                  {/* Withdrawal Form */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                          <div className="w-1 h-5 bg-orange-500 rounded"></div>
                          Withdraw via PayPal
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">Direct withdrawal to your PayPal account</p>
                      </div>
                      {!showWithdrawForm && availableBalance > 0 && (
                        <button
                          onClick={() => setShowWithdrawForm(true)}
                          className="px-5 py-2.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium shadow-md hover:shadow-lg"
                        >
                          Withdraw Funds
                        </button>
                      )}
                    </div>

                    {showWithdrawForm ? (
                      <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl p-6 border-2 border-orange-200">
                        <div className="space-y-5">
                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              Withdrawal Amount (PHP)
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₱</span>
                              <input
                                type="number"
                                min="100"
                                max={availableBalance}
                                value={withdrawForm.amount}
                                onChange={(e) => setWithdrawForm({ ...withdrawForm, amount: e.target.value })}
                                placeholder="Enter amount"
                                className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-medium"
                              />
                            </div>
                            <p className="text-xs text-gray-600 mt-2">
                              Maximum: ₱{availableBalance.toLocaleString()} • Minimum: ₱100
                            </p>
                          </div>

                          <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                              PayPal Email Address
                            </label>
                            <div className="relative">
                              <input
                                type="email"
                                value={withdrawForm.channelAccount}
                                onChange={(e) => setWithdrawForm({ ...withdrawForm, channelAccount: e.target.value })}
                                placeholder="your.email@example.com"
                                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                              />
                            </div>
                            <p className="text-xs text-gray-600 mt-2 flex items-start gap-2">
                              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                              Ensure your PayPal email is correct to receive the payment
                            </p>
                          </div>

                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <p className="text-sm text-blue-900 font-medium mb-1">How It Works</p>
                            <ul className="text-xs text-blue-800 space-y-1">
                              <li>• Click the PayPal button below to process withdrawal</li>
                              <li>• Complete the payment on PayPal's secure checkout</li>
                              <li>• Funds will be transferred to your PayPal account</li>
                              <li>• Transaction is recorded in your history</li>
                            </ul>
                          </div>

                          {withdrawForm.amount && withdrawForm.channelAccount && parseFloat(withdrawForm.amount) > 0 && parseFloat(withdrawForm.amount) <= availableBalance ? (
                            <PayPalScriptProvider
                              options={{
                                "client-id": "AWUL2gT-UI3zhd5TNRY_gz-yxK-xvBlYMqnfG2ULdCNkgwtqAN4zWX0uuDYf1tWpEl0ymrAa6z9MXGi3",
                                currency: "PHP",
                              }}
                            >
                              <PayPalButtons
                                style={{
                                  layout: "vertical",
                                  color: "gold",
                                  shape: "rect",
                                  label: "pay",
                                }}
                                createOrder={(data, actions) => {
                                  return actions.order.create({
                                    purchase_units: [
                                      {
                                        description: `Withdrawal to ${withdrawForm.channelAccount}`,
                                        amount: {
                                          value: parseFloat(withdrawForm.amount).toFixed(2),
                                          currency_code: "PHP",
                                        },
                                        payee: {
                                          email_address: withdrawForm.channelAccount,
                                        },
                                      },
                                    ],
                                  });
                                }}
                                onApprove={async (data, actions) => {
                                  try {
                                    const details = await actions.order.capture();
                                    console.log("✅ PayPal Withdrawal Details:", details);

                                    // Record the withdrawal in database
                                    await addDoc(collection(db, "withdrawals"), {
                                      hostId: auth.currentUser.uid,
                                      amount: parseFloat(withdrawForm.amount),
                                      channelType: "paypal",
                                      channelAccount: withdrawForm.channelAccount,
                                      status: "completed",
                                      paymentId: details.id,
                                      createdAt: new Date(),
                                    });

                                    // Refresh withdrawals
                                    const withdrawalsSnapshot = await getDocs(
                                      query(collection(db, "withdrawals"), where("hostId", "==", auth.currentUser.uid))
                                    );
                                    setWithdrawals(withdrawalsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));

                                    setWithdrawForm({ amount: "", channelType: "paypal", channelAccount: "" });
                                    setShowWithdrawForm(false);
                                    
                                    alert("✅ Withdrawal completed successfully!");
                                  } catch (error) {
                                    console.error("❌ Withdrawal Error:", error);
                                    alert("❌ Withdrawal processed but failed to save record. Contact support.");
                                  }
                                }}
                                onError={(err) => {
                                  console.error("PayPal Error:", err);
                                  alert("❌ Withdrawal failed. Please try again.");
                                }}
                              />
                            </PayPalScriptProvider>
                          ) : (
                            <div className="text-center py-4 text-sm text-gray-600 bg-gray-50 rounded-lg border border-gray-200">
                              Please enter a valid amount and PayPal email to continue
                            </div>
                          )}

                          <div className="flex gap-3 pt-2">
                            <button
                              onClick={() => { 
                                setShowWithdrawForm(false); 
                                setWithdrawForm({ amount: "", channelType: "paypal", channelAccount: "" }); 
                              }}
                              className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      availableBalance === 0 && (
                        <div className="text-center py-8">
                          <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                            <PiggyBank className="w-8 h-8 text-gray-400" />
                          </div>
                          <p className="text-gray-600 font-medium">No available balance</p>
                          <p className="text-sm text-gray-500 mt-1">Complete bookings to earn and withdraw funds</p>
                        </div>
                      )
                    )}
                  </div>

                  {/* Recent Withdrawal History */}
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                      <div className="w-1 h-5 bg-orange-500 rounded"></div>
                      Withdrawal History
                    </h3>
                    {withdrawals.length === 0 ? (
                      <div className="text-center py-10">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                          <Banknote className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium">No withdrawals yet</p>
                        <p className="text-sm text-gray-500 mt-1">Your withdrawal history will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {withdrawals.sort((a,b)=> new Date(b.createdAt?.seconds? b.createdAt.seconds*1000: b.createdAt) - new Date(a.createdAt?.seconds? a.createdAt.seconds*1000: a.createdAt)).map(w => {
                          const date = new Date(w.createdAt?.seconds ? w.createdAt.seconds * 1000 : w.createdAt);
                          
                          return (
                            <div key={w.id} className="p-5 rounded-xl border-2 border-green-300 bg-green-50 hover:shadow-md transition-all">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-3 mb-2">
                                    <p className="text-2xl font-bold text-gray-900">₱{(w.amount||0).toLocaleString()}</p>
                                    <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                                      ✓ COMPLETED
                                    </span>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm text-gray-700 font-medium flex items-center gap-2">
                                      <span className="text-lg">💳</span>
                                      PayPal: {w.channelAccount}
                                    </p>
                                    <p className="text-xs text-gray-600">
                                      Withdrawn on {date.toLocaleDateString('en-US',{ month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Earnings History Tab */}
              {activeTab === "history" && (
                <div className="space-y-6">
                  <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                      <div className="w-1 h-5 bg-orange-500 rounded"></div>
                      Transaction History
                    </h3>
                    
                    {activeBookings.length === 0 && withdrawals.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Banknote className="w-10 h-10 text-gray-400" />
                        </div>
                        <p className="text-gray-600 font-medium text-lg">No transactions yet</p>
                        <p className="text-sm text-gray-500 mt-2">Your earnings and withdrawals will appear here</p>
                      </div>
                    ) : (
                      <div className="space-y-8">
                        {/* Bookings Section */}
                        {activeBookings.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="bg-green-100 p-2 rounded-lg">
                                <DollarSign className="w-5 h-5 text-green-600" />
                              </div>
                              <h4 className="font-bold text-gray-800">Earnings from Bookings</h4>
                              <span className="ml-auto text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                {activeBookings.length} {activeBookings.length === 1 ? 'booking' : 'bookings'}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {activeBookings
                                .sort((a, b) => {
                                  const dateA = new Date(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt);
                                  const dateB = new Date(b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt);
                                  return dateB - dateA;
                                })
                                .map((booking) => {
                                  const earnings = booking.finalPrice || booking.price || 0;
                                  const discount = booking.discount || 0;
                                  const originalPrice = booking.price || 0;
                                  const bookingDate = new Date(
                                    booking.createdAt?.seconds 
                                      ? booking.createdAt.seconds * 1000 
                                      : booking.createdAt
                                  );
                                  return (
                                    <div
                                      key={booking.id}
                                      className="p-5 bg-gradient-to-r from-green-50 to-white rounded-xl border-2 border-green-200 hover:shadow-md transition-all"
                                    >
                                      <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                                            <h3 className="font-bold text-gray-900 text-lg">{booking.listingTitle}</h3>
                                            {booking.couponUsed && (
                                              <span className="px-2.5 py-0.5 bg-orange-500 text-white text-xs font-bold rounded-full">
                                                COUPON
                                              </span>
                                            )}
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-700">
                                            <p className="flex items-center gap-2">
                                              <span className="font-semibold text-gray-800">📅 Booked:</span>
                                              {bookingDate.toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric"
                                              })}
                                            </p>
                                            <p className="flex items-center gap-2">
                                              <span className="font-semibold text-gray-800">🏠 Check-in:</span>
                                              {new Date(
                                                booking.checkIn?.seconds 
                                                  ? booking.checkIn.seconds * 1000 
                                                  : booking.checkIn
                                              ).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric"
                                              })}
                                            </p>
                                            <p className="flex items-center gap-2">
                                              <span className="font-semibold text-gray-800">👥 Guests:</span>
                                              {(booking.guests?.adults || 0) +
                                                (booking.guests?.children || 0) +
                                                (booking.guests?.infants || 0) +
                                                (booking.guests?.pets || 0)}
                                            </p>
                                          </div>
                                        </div>
                                        <div className="text-right flex-shrink-0">
                                          {discount > 0 ? (
                                            <>
                                              <p className="text-sm text-gray-400 line-through">
                                                ₱{originalPrice.toLocaleString()}
                                              </p>
                                              <p className="text-2xl font-bold text-green-600">
                                                +₱{earnings.toLocaleString()}
                                              </p>
                                              <p className="text-xs text-gray-600 mt-1 bg-orange-100 px-2 py-1 rounded">
                                                -₱{discount.toLocaleString()} discount
                                              </p>
                                            </>
                                          ) : (
                                            <p className="text-2xl font-bold text-green-600">
                                              +₱{earnings.toLocaleString()}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}

                        {/* Withdrawals Section */}
                        {withdrawals.length > 0 && (
                          <div>
                            <div className="flex items-center gap-2 mb-4">
                              <div className="bg-blue-100 p-2 rounded-lg">
                                <PiggyBank className="w-5 h-5 text-blue-600" />
                              </div>
                              <h4 className="font-bold text-gray-800">Withdrawals</h4>
                              <span className="ml-auto text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                {withdrawals.length} {withdrawals.length === 1 ? 'withdrawal' : 'withdrawals'}
                              </span>
                            </div>
                            <div className="space-y-3">
                              {withdrawals
                                .sort((a,b)=> new Date(b.createdAt?.seconds? b.createdAt.seconds*1000: b.createdAt) - new Date(a.createdAt?.seconds? a.createdAt.seconds*1000: a.createdAt))
                                .map(w => {
                                  const date = new Date(w.createdAt?.seconds ? w.createdAt.seconds * 1000 : w.createdAt);
                                  
                                  return (
                                    <div key={w.id} className="p-5 rounded-xl border-2 border-green-300 bg-green-50 hover:shadow-md transition-all">
                                      <div className="flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-3 mb-2">
                                            <p className="text-2xl font-bold text-gray-900">-₱{(w.amount||0).toLocaleString()}</p>
                                            <span className="px-3 py-1 bg-green-500 text-white text-xs font-bold rounded-full">
                                              ✓ COMPLETED
                                            </span>
                                          </div>
                                          <div className="space-y-1">
                                            <p className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                                              <span className="text-base">💳</span>
                                              PayPal: {w.channelAccount}
                                            </p>
                                            <p className="text-xs text-gray-600">
                                              {date.toLocaleDateString('en-US',{ month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Earnings;

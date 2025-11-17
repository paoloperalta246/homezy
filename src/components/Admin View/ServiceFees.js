
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, orderBy, query, where, setDoc, updateDoc } from "firebase/firestore";
import { getUserPoints, addPoints } from '../../utils/points';
import { sendNotification } from '../../utils/notify';

import { auth, db } from "../../firebase";
import homezyLogo from "../Host View/images/homezy-logo.png";
import { LayoutDashboard, Users, DollarSign, FileText, Shield, Settings, LogOut, User, Book } from "lucide-react";

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ServiceFees = () => {
    // PDF Export: Host Subscription Plans
    const exportHostSubsPDF = (hostList = hosts) => {
        if (!hostList.length) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Host Subscription Plans", 14, 18);
        autoTable(doc, {
            startY: 26,
            head: [["Host", "Email", "Plan", "Fee (₱)", "Payment Date", "Expires On", "Status"]],
            body: hostList.map(h => {
                const fee = serviceFees.find(f => f.hostId === h.id && f.plan === h.subscriptionPlan);
                // Payment Date
                let paymentDate = fee && fee.paymentDate && fee.paymentDate.seconds ? new Date(fee.paymentDate.seconds * 1000).toLocaleDateString() : '-';
                // Expires On
                let expiresOn = '-';
                if (fee && fee.expirationDate) {
                    if (fee.expirationDate.seconds) expiresOn = new Date(fee.expirationDate.seconds * 1000).toLocaleDateString();
                    else if (fee.expirationDate.toDate) expiresOn = fee.expirationDate.toDate().toLocaleDateString();
                    else if (fee.expirationDate instanceof Date) expiresOn = fee.expirationDate.toLocaleDateString();
                } else if (fee && fee.paymentDate && fee.paymentDate.seconds && h.subscriptionPlan) {
                    const planDuration = h.subscriptionPlan === 'basic' ? 1 : h.subscriptionPlan === 'pro' ? 3 : h.subscriptionPlan === 'premium' ? 12 : 1;
                    const paidDate = new Date(fee.paymentDate.seconds * 1000);
                    const expDate = new Date(paidDate);
                    expDate.setMonth(expDate.getMonth() + planDuration);
                    expiresOn = expDate.toLocaleDateString();
                }
                return [
                    h.fullName || '-',
                    h.email || '-',
                    h.subscriptionPlan || '-',
                    h.subscriptionPrice ? `₱${h.subscriptionPrice}` : '-',
                    paymentDate,
                    expiresOn,
                    fee ? 'Paid' : 'Unpaid',
                ];
            }),
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [255, 153, 51], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [255, 247, 237] },
            margin: { left: 10, right: 10 },
        });
        doc.save(`host_subscription_plans_${Date.now()}.pdf`);
    };


    // PDF Export: Payment History
    const exportPaymentHistoryPDF = () => {
        if (!filteredServiceFees.length) return;
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.text("Payment History", 14, 18);
        autoTable(doc, {
            startY: 26,
            head: [["Host", "Email", "Plan", "Amount", "Paid On", "Expires On", "Status"]],
            body: filteredServiceFees.map(fee => {
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
                return [
                    host?.fullName || '-',
                    host?.email || '-',
                    fee.plan || '-',
                    `₱${fee.amount}`,
                    paidOn,
                    expiresOn,
                    fee.status === 'paid' ? 'Paid' : fee.status,
                ];
            }),
            styles: { fontSize: 10, cellPadding: 3 },
            headStyles: { fillColor: [51, 153, 255], textColor: 255, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [237, 245, 255] },
            margin: { left: 10, right: 10 },
        });
        doc.save(`payment_history_${Date.now()}.pdf`);
    };
    const [admin, setAdmin] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [bookings, setBookings] = useState([]);
    const [hosts, setHosts] = useState([]);
    const [serviceFees, setServiceFees] = useState([]);
    const [hostPoints, setHostPoints] = useState({});
    // Payment history modal state
    // Editable plans state (admin can edit)
    const [editablePlans, setEditablePlans] = useState([]);
    const [plansLoading, setPlansLoading] = useState(true);
    // Load plans from Firestore on mount
    useEffect(() => {
        const fetchPlans = async () => {
            setPlansLoading(true);
            try {
                const plansSnap = await getDocs(collection(db, "subscriptionPlans"));
                let plans = plansSnap.docs.map(doc => ({ ...doc.data(), id: doc.id, editing: false }));
                // If no plans exist, seed with defaults
                if (plans.length === 0) {
                    plans = [
                        {
                            id: "basic",
                            name: "Basic",
                            price: 500,
                            period: "month",
                            features: ["Up to 5 property listings", "Basic analytics dashboard", "Email support within 48hrs", "Standard listing visibility"],
                            editing: false,
                        },
                        {
                            id: "pro",
                            name: "Pro",
                            price: 1200,
                            period: "3 months",
                            features: ["Up to 20 property listings", "Advanced analytics & insights", "Priority support within 24hrs", "Enhanced listing visibility", "Marketing tools access"],
                            editing: false,
                        },
                        {
                            id: "premium",
                            name: "Premium",
                            price: 4500,
                            period: "year",
                            features: ["Unlimited property listings", "Premium analytics suite", "24/7 dedicated phone support", "Featured homepage placement", "Full marketing automation", "Personal account manager"],
                            editing: false,
                        },
                    ];
                    // Seed Firestore
                    for (const plan of plans) {/* Lines 59-60 omitted */ }
                }
                // Sort plans: basic, pro, premium
                const order = ["basic", "pro", "premium"];
                plans.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
                setEditablePlans(plans);
            } catch (e) {
                console.error("Failed to fetch subscription plans", e);
            } finally {
                setPlansLoading(false);
            }
        };
        fetchPlans();
    }, []);

    // For editing features
    const [featureInputs, setFeatureInputs] = useState({});

    // Handle edit button
    const handleEditPlan = (planId) => {
        setEditablePlans(plans => plans.map(p => p.id === planId ? { ...p, editing: true } : { ...p, editing: false }));
        const plan = editablePlans.find(p => p.id === planId);
        setFeatureInputs({ [planId]: plan && plan.features ? plan.features.join("\n") : "" });
    };

    // Handle cancel
    const handleCancelEdit = (planId) => {
        setEditablePlans(plans => plans.map(p => p.id === planId ? { ...p, editing: false } : p));
    };

    // Handle save
    const handleSavePlan = async (planId) => {
        setEditablePlans(plans => plans.map(p => {
            if (p.id !== planId) return p;
            return {
                ...p,
                editing: false,
                features: (featureInputs[planId] || "").split("\n").map(f => f.trim()).filter(f => f),
            };
        }));
        // Save to Firestore
        const plan = editablePlans.find(p => p.id === planId);
        if (plan) {
            const updatedPlan = {
                ...plan,
                features: (featureInputs[planId] || "").split("\n").map(f => f.trim()).filter(f => f),
                editing: false,
            };
            await setDoc(doc(db, "subscriptionPlans", planId), updatedPlan);
        }
    };

    // Handle input changes
    const handlePlanInputChange = (planId, field, value) => {
        setEditablePlans(plans => plans.map(p => p.id === planId ? { ...p, [field]: value } : p));
    };

    // Handle feature textarea change
    const handleFeatureInputChange = (planId, value) => {
        setFeatureInputs(inputs => ({ ...inputs, [planId]: value }));
    };
    const [historyHost, setHistoryHost] = useState(null); // host object
    const [historyOpen, setHistoryOpen] = useState(false);
    const [historyRows, setHistoryRows] = useState([]); // array of serviceFees for selected host


    // Modal state for approve/reject actions
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [modalMessage, setModalMessage] = useState("");
    const paymentHistoryRef = useRef(null);
    const [scrollToHistory, setScrollToHistory] = useState(false);

    // Approve a pending service fee
    const handleApproveFee = async (fee) => {
        try {
            if (fee.paymentMethod === 'points') {
                await addPoints(fee.hostId, -fee.amount, 'service_fee_payment', { plan: fee.plan });
            }
            const now = new Date();
            let months = 1;
            if (fee.plan === 'pro') months = 3;
            if (fee.plan === 'premium') months = 12;
            const expirationDate = new Date(now);
            expirationDate.setMonth(expirationDate.getMonth() + months);
            await updateDoc(doc(db, 'serviceFees', fee.id), {
                status: 'paid',
                approvedAt: new Date(),
                expirationDate,
            });
            await sendNotification({
                userId: fee.hostId,
                type: 'service_fee_approved',
                title: 'Subscription Payment Approved',
                body: `Your payment for the ${fee.plan} plan has been approved by admin.`,
                meta: { plan: fee.plan, amount: fee.amount }
            });
            const feesSnap = await getDocs(collection(db, "serviceFees"));
            setServiceFees(feesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setModalMessage("Payment approved successfully!");
            setShowApproveModal(true);
            setScrollToHistory(true);
        } catch (e) {
            setModalMessage('Failed to approve payment.');
            setShowApproveModal(true);
        }
    };

    // Reject a pending service fee
    const handleRejectFee = async (fee) => {
        try {
            await updateDoc(doc(db, 'serviceFees', fee.id), {
                status: 'rejected',
                rejectedAt: new Date(),
            });
            await sendNotification({
                userId: fee.hostId,
                type: 'service_fee_rejected',
                title: 'Subscription Payment Rejected',
                body: `Your payment for the ${fee.plan} plan was rejected by admin. Please contact support.`,
                meta: { plan: fee.plan, amount: fee.amount }
            });
            const feesSnap = await getDocs(collection(db, "serviceFees"));
            setServiceFees(feesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setModalMessage("Payment request rejected.");
            setShowRejectModal(true);
            setScrollToHistory(true);
        } catch (e) {
            setModalMessage('Failed to reject payment.');
            setShowRejectModal(true);
        }
    };

    // Scroll to payment history after modal closes
    useEffect(() => {
        if (scrollToHistory && paymentHistoryRef.current) {
            paymentHistoryRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setScrollToHistory(false);
        }
    }, [scrollToHistory]);

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

    // Filtering and Pagination state for Payment History
    const [historyPage, setHistoryPage] = useState(1);
    const [filter, setFilter] = useState({
        host: '',
        plan: '',
        status: '',
        startDate: '', // format: 'YYYY-MM-DD'
        endDate: '',   // format: 'YYYY-MM-DD'
    });
    const rowsPerPage = 10;
    // Get unique hosts and plans for filter dropdowns
    const hostOptions = hosts.map(h => ({ id: h.id, name: h.fullName || h.email || 'Unknown Host' }));
    const planOptions = Array.from(new Set(serviceFees.map(fee => fee.plan))).filter(Boolean);
    const statusOptions = ['paid', 'pending', 'rejected'];

    // Filtering logic
    const filteredServiceFees = serviceFees
        .slice()
        .sort((a, b) => {
            const aTime = a.paymentDate?.seconds ? a.paymentDate.seconds : 0;
            const bTime = b.paymentDate?.seconds ? b.paymentDate.seconds : 0;
            return bTime - aTime;
        })
        .filter(fee => hosts.find(h => h.id === fee.hostId))
        .filter(fee => {
            // Host filter
            if (filter.host && fee.hostId !== filter.host) return false;
            // Plan filter
            if (filter.plan && fee.plan !== filter.plan) return false;
            // Status filter
            if (filter.status && fee.status !== filter.status) return false;
            // Date filter
            if (filter.startDate) {
                const paid = fee.paymentDate?.seconds ? new Date(fee.paymentDate.seconds * 1000) : fee.paymentDate?.toDate ? fee.paymentDate.toDate() : (fee.paymentDate instanceof Date ? fee.paymentDate : null);
                if (!paid || paid < new Date(filter.startDate + 'T00:00:00')) return false;
            }
            if (filter.endDate) {
                const paid = fee.paymentDate?.seconds ? new Date(fee.paymentDate.seconds * 1000) : fee.paymentDate?.toDate ? fee.paymentDate.toDate() : (fee.paymentDate instanceof Date ? fee.paymentDate : null);
                if (!paid || paid > new Date(filter.endDate + 'T23:59:59')) return false;
            }
            return true;
        });
    const totalPages = Math.ceil(filteredServiceFees.length / rowsPerPage);
    const paginatedFees = filteredServiceFees.slice((historyPage - 1) * rowsPerPage, historyPage * rowsPerPage);

    // PDF Preview modal state
    const [pdfPreview, setPdfPreview] = useState({ open: false, type: null });

    // For backward compatibility: pagedServiceFees alias for filteredServiceFees
    const pagedServiceFees = filteredServiceFees;

    // Host Subscription Plans Filters (mirroring Payment History)
    const [hostSubsFilter, setHostSubsFilter] = useState({
        host: '',
        plan: '',
        status: '',
        startDate: '',
        endDate: '',
    });
    // Host options for filter
    const hostSubsHostOptions = hosts.map(h => ({ id: h.id, name: h.fullName || h.email || 'Unknown Host' }));
    // Plan options for filter
    const hostSubsPlanOptions = Array.from(new Set(hosts.map(h => h.subscriptionPlan))).filter(Boolean);
    // Status options for filter
    const hostSubsStatusOptions = ['paid', 'unpaid'];
    // Filtering logic for Host Subscription Plans
    const filteredHosts = hosts.filter(h => {
        // Host filter
        if (hostSubsFilter.host && h.id !== hostSubsFilter.host) return false;
        // Plan filter
        if (hostSubsFilter.plan && h.subscriptionPlan !== hostSubsFilter.plan) return false;
        // Status filter
        const fee = serviceFees.find(f => f.hostId === h.id && f.plan === h.subscriptionPlan);
        if (hostSubsFilter.status) {
            if (hostSubsFilter.status === 'paid' && !fee) return false;
            if (hostSubsFilter.status === 'unpaid' && fee) return false;
        }
        // Date filter
        if (hostSubsFilter.startDate) {
            const paid = fee && fee.paymentDate?.seconds ? new Date(fee.paymentDate.seconds * 1000) : fee && fee.paymentDate?.toDate ? fee.paymentDate.toDate() : (fee && fee.paymentDate instanceof Date ? fee.paymentDate : null);
            if (!paid || paid < new Date(hostSubsFilter.startDate + 'T00:00:00')) return false;
        }
        if (hostSubsFilter.endDate) {
            const paid = fee && fee.paymentDate?.seconds ? new Date(fee.paymentDate.seconds * 1000) : fee && fee.paymentDate?.toDate ? fee.paymentDate.toDate() : (fee && fee.paymentDate instanceof Date ? fee.paymentDate : null);
            if (!paid || paid > new Date(hostSubsFilter.endDate + 'T23:59:59')) return false;
        }
        return true;
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

                {/* Pending Service Fee Approvals (Admin) */}
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-yellow-900 mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-yellow-500" />
                        Pending Service Fee Approvals
                    </h3>
                    {serviceFees.filter(fee => fee.status === 'pending').length === 0 ? (
                        <div className="text-yellow-400 text-center py-8 text-base font-semibold bg-yellow-50 rounded-xl border border-yellow-100 shadow-inner">No pending approvals.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {serviceFees.filter(fee => fee.status === 'pending').map((fee, idx) => {
                                const host = hosts.find(h => h.id === fee.hostId);
                                return (
                                    <div
                                        key={fee.id}
                                        className="relative bg-gradient-to-br from-yellow-50 via-white to-yellow-100 border-2 border-yellow-200 rounded-2xl p-6 shadow-lg flex flex-col gap-4 hover:shadow-2xl transition-all duration-200"
                                    >
                                        <div className="flex items-center gap-4 mb-2">
                                            {host?.photoURL ? (
                                                <img src={host.photoURL} alt={host.fullName} className="w-12 h-12 rounded-full object-cover border-2 border-yellow-300 shadow" />
                                            ) : (
                                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-white font-bold text-xl border-2 border-yellow-300 shadow">
                                                    {host?.fullName ? host.fullName.charAt(0).toUpperCase() : "?"}
                                                </div>
                                            )}
                                            <div className="flex flex-col min-w-0">
                                                <span className="font-bold text-yellow-900 text-lg truncate max-w-[180px]">{host?.fullName || 'Unknown Host'}</span>
                                                <span className="text-xs text-yellow-700 font-medium truncate max-w-[180px]">{host?.email}</span>
                                            </div>
                                            <span className="ml-auto px-3 py-1 rounded-full bg-yellow-200 text-yellow-900 text-xs font-bold shadow">Pending</span>
                                        </div>
                                        <div className="flex flex-wrap gap-4 text-sm text-yellow-800 font-medium">
                                            <div className="flex items-center gap-1">
                                                <span className="font-semibold">Plan:</span>
                                                <span className="capitalize">{fee.plan}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="font-semibold">Amount:</span>
                                                <span>₱{fee.amount}</span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <span className="font-semibold">Method:</span>
                                                <span className="capitalize">{fee.paymentMethod}</span>
                                            </div>
                                            {fee.createdAt && (
                                                <div className="flex items-center gap-1">
                                                    <span className="font-semibold">Requested:</span>
                                                    <span>{fee.createdAt.seconds ? new Date(fee.createdAt.seconds * 1000).toLocaleDateString() : '-'}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-3 mt-2 justify-end">
                                            <button
                                                onClick={() => handleApproveFee(fee)}
                                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-green-400 to-green-500 text-white font-bold text-sm shadow hover:scale-105 hover:bg-green-600 transition-all duration-150"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                                Approve
                                            </button>
                                            <button
                                                onClick={() => handleRejectFee(fee)}
                                                className="flex items-center gap-2 px-5 py-2 rounded-lg bg-gradient-to-r from-red-400 to-red-500 text-white font-bold text-sm shadow hover:scale-105 hover:bg-red-600 transition-all duration-150"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="mb-8">
                    <h3 className="text-lg font-bold text-orange-900 mb-2 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-orange-500" />
                        Available Host Subscription Plans
                    </h3>
                    {plansLoading ? (
                        <div className="text-orange-400 text-center py-8 text-lg">Loading plans...</div>
                    ) : (
                        <div className="flex flex-col sm:flex-row gap-4">
                            {editablePlans.map((plan, idx) => (
                                <div
                                    key={plan.id}
                                    className={
                                        "flex-1 relative bg-white border border-orange-200 shadow-sm rounded-2xl p-6 flex flex-col items-start"
                                    }
                                >
                                    {plan.editing ? (
                                        <>
                                            <input
                                                className="font-bold text-orange-700 text-base mb-1 w-full border-b border-orange-200 focus:outline-none focus:border-orange-400 bg-white"
                                                value={plan.name}
                                                onChange={e => handlePlanInputChange(plan.id, 'name', e.target.value)}
                                            />
                                            <div className="flex items-baseline gap-2 mb-1 w-full">
                                                <span className="text-xl font-extrabold text-orange-900">₱</span>
                                                <input
                                                    type="number"
                                                    className="text-2xl font-extrabold text-orange-900 mb-1 w-20 border-b border-orange-200 focus:outline-none focus:border-orange-400 bg-white"
                                                    value={plan.price}
                                                    min={0}
                                                    onChange={e => handlePlanInputChange(plan.id, 'price', e.target.value)}
                                                />
                                            </div>
                                            <input
                                                className="text-sm text-orange-600 mb-1 w-full border-b border-orange-200 focus:outline-none focus:border-orange-400 bg-white"
                                                value={plan.period}
                                                onChange={e => handlePlanInputChange(plan.id, 'period', e.target.value)}
                                            />
                                            <label className="text-xs text-orange-500 mt-2 mb-1 font-semibold">Benefits (one per line):</label>
                                            <textarea
                                                className="w-full text-xs text-orange-700 border border-orange-200 rounded p-2 mb-2 focus:outline-none focus:border-orange-400 bg-white"
                                                rows={5}
                                                value={featureInputs[plan.id] || ''}
                                                onChange={e => handleFeatureInputChange(plan.id, e.target.value)}
                                            />
                                            <div className="flex gap-2 mt-2">
                                                <button
                                                    className="px-3 py-1 rounded bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs shadow hover:opacity-90"
                                                    onClick={() => handleSavePlan(plan.id)}
                                                >Save</button>
                                                <button
                                                    className="px-3 py-1 rounded bg-gray-200 text-gray-700 font-bold text-xs shadow hover:bg-gray-300"
                                                    onClick={() => handleCancelEdit(plan.id)}
                                                >Cancel</button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span className="font-bold text-orange-700 text-base mb-1">{plan.name}</span>
                                            <span className="text-2xl font-extrabold text-orange-900 mb-1">₱{plan.price.toLocaleString()}</span>
                                            <span className="text-sm text-orange-600 mb-1">per {plan.period}</span>
                                            <ul className="mt-2 mb-2 space-y-1">
                                                {plan.features.map((f, i) => (
                                                    <li key={i} className="text-xs text-orange-500 flex items-start gap-2">
                                                        <span className="mt-0.5">•</span> <span>{f}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            <button
                                                className="px-3 py-1 rounded bg-gradient-to-r from-orange-500 to-amber-500 text-white font-bold text-xs shadow hover:opacity-90 mt-2"
                                                onClick={() => handleEditPlan(plan.id)}
                                            >Edit</button>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Service Fee Table */}
                <div ref={paymentHistoryRef} className="overflow-x-visible bg-gradient-to-br from-orange-50 via-white to-orange-100 border border-orange-200 rounded-3xl mb-14 p-2 sm:p-6">
                    {/* Approve Modal */}
                    {showApproveModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full flex flex-col items-center">
                                <div className="text-green-600 text-3xl mb-2">✔️</div>
                                <div className="text-lg font-bold mb-2">{modalMessage}</div>
                                <button
                                    className="mt-4 px-6 py-2 bg-green-500 text-white rounded-lg font-semibold shadow hover:bg-green-600"
                                    onClick={() => setShowApproveModal(false)}
                                >OK</button>
                            </div>
                        </div>
                    )}
                    {/* Reject Modal */}
                    {showRejectModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full flex flex-col items-center">
                                <div className="text-red-600 text-3xl mb-2">❌</div>
                                <div className="text-lg font-bold mb-2">{modalMessage}</div>
                                <button
                                    className="mt-4 px-6 py-2 bg-red-500 text-white rounded-lg font-semibold shadow hover:bg-red-600"
                                    onClick={() => setShowRejectModal(false)}
                                >OK</button>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-extrabold text-orange-900 px-2 sm:px-0 pt-2 pb-1 flex items-center gap-2">
                            <DollarSign className="w-7 h-7 text-orange-500" />
                            Host Subscription Plans
                        </h3>
                        <button
                            onClick={() => setPdfPreview({ open: true, type: 'hostSubs' })}
                            className="group bg-gradient-to-r from-orange-500 to-orange-400 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-300 relative"
                            style={{ minWidth: 160 }}
                        >
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            </span>
                            <span className="tracking-wide">Export as PDF</span>
                            <span className="absolute -top-2 -right-2 bg-orange-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
                        </button>
                        {/* PDF Preview Modal for Host Subscription Plans */}
                        {pdfPreview.open && pdfPreview.type === 'hostSubs' && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
                                    <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
                                        <h3 className="text-lg sm:text-xl font-semibold text-orange-600 flex items-center gap-2">
                                            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500 mr-1" />
                                            Host Subscription Plans Preview
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
                                                    <th className="px-2 py-2 text-left font-bold text-orange-700">Host</th>
                                                    <th className="px-2 py-2 text-left font-bold text-orange-700">Email</th>
                                                    <th className="px-2 py-2 text-left font-bold text-orange-700">Plan</th>
                                                    <th className="px-2 py-2 text-left font-bold text-orange-700">Fee (₱)</th>
                                                    <th className="px-2 py-2 text-left font-bold text-orange-700">Payment Date</th>
                                                    <th className="px-2 py-2 text-left font-bold text-orange-700">Expires On</th>
                                                    <th className="px-2 py-2 text-left font-bold text-orange-700">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredHosts.length === 0 ? (
                                                    <tr><td colSpan={7} className="text-center text-gray-400 py-4">No hosts found.</td></tr>
                                                ) : (
                                                    filteredHosts.map((h) => {
                                                        const fee = serviceFees.find(f => f.hostId === h.id && f.plan === h.subscriptionPlan);
                                                        let paidOn = '-';
                                                        if (fee && fee.paymentDate) {
                                                            if (fee.paymentDate.seconds) paidOn = new Date(fee.paymentDate.seconds * 1000).toLocaleDateString();
                                                            else if (fee.paymentDate.toDate) paidOn = fee.paymentDate.toDate().toLocaleDateString();
                                                            else if (fee.paymentDate instanceof Date) paidOn = fee.paymentDate.toLocaleDateString();
                                                        }
                                                        let expiresOn = '-';
                                                        if (fee && fee.expirationDate) {
                                                            if (fee.expirationDate.seconds) expiresOn = new Date(fee.expirationDate.seconds * 1000).toLocaleDateString();
                                                            else if (fee.expirationDate.toDate) expiresOn = fee.expirationDate.toDate().toLocaleDateString();
                                                            else if (fee.expirationDate instanceof Date) expiresOn = fee.expirationDate.toLocaleDateString();
                                                        } else if (fee && fee.paymentDate && h.subscriptionPlan) {
                                                            const planDuration = h.subscriptionPlan === 'basic' ? 1 : h.subscriptionPlan === 'pro' ? 3 : h.subscriptionPlan === 'premium' ? 12 : 1;
                                                            const paidDate = new Date(fee.paymentDate.seconds * 1000);
                                                            const expDate = new Date(paidDate);
                                                            expDate.setMonth(expDate.getMonth() + planDuration);
                                                            expiresOn = expDate.toLocaleDateString();
                                                        }
                                                        return (
                                                            <tr key={h.id} className="border-b border-orange-50">
                                                                <td className="px-2 py-2">{h.fullName || '-'}</td>
                                                                <td className="px-2 py-2">{h.email || '-'}</td>
                                                                <td className="px-2 py-2">{h.subscriptionPlan || '-'}</td>
                                                                <td className="px-2 py-2">{h.subscriptionPrice ? `₱${h.subscriptionPrice}` : '-'}</td>
                                                                <td className="px-2 py-2">{paidOn}</td>
                                                                <td className="px-2 py-2">{expiresOn}</td>
                                                                <td className="px-2 py-2">{fee ? 'Paid' : 'Unpaid'}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2 border-t border-gray-100">
                                        <button
                                            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-6 py-2 rounded-lg shadow transition"
                                            onClick={() => { exportHostSubsPDF(filteredHosts); setPdfPreview({ open: false, type: null }); }}
                                            disabled={filteredHosts.length === 0}
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
                    <p className="px-2 sm:px-0 pb-4 text-orange-700/80 text-sm">Overview of each host's current subscription and payment status.</p>
                    {/* Host Subscription Plans Filters */}
                    <div className="flex flex-wrap gap-2 items-center mb-4">
                        {/* Host Filter */}
                        <select
                            className="px-3 py-1.5 rounded-lg border border-orange-200 bg-white text-orange-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 min-w-[120px]"
                            value={hostSubsFilter.host}
                            onChange={e => setHostSubsFilter(f => ({ ...f, host: e.target.value }))}
                        >
                            <option value="">All Hosts</option>
                            {hostSubsHostOptions.map(h => (
                                <option key={h.id} value={h.id}>{h.name}</option>
                            ))}
                        </select>
                        {/* Plan Filter */}
                        <select
                            className="px-3 py-1.5 rounded-lg border border-orange-200 bg-white text-orange-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 min-w-[110px]"
                            value={hostSubsFilter.plan}
                            onChange={e => setHostSubsFilter(f => ({ ...f, plan: e.target.value }))}
                        >
                            <option value="">All Plans</option>
                            {hostSubsPlanOptions.map(plan => (
                                <option key={plan} value={plan}>{plan}</option>
                            ))}
                        </select>
                        {/* Status Filter */}
                        <select
                            className="px-3 py-1.5 rounded-lg border border-orange-200 bg-white text-orange-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 min-w-[110px]"
                            value={hostSubsFilter.status}
                            onChange={e => setHostSubsFilter(f => ({ ...f, status: e.target.value }))}
                        >
                            <option value="">All Statuses</option>
                            {hostSubsStatusOptions.map(status => (
                                <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                            ))}
                        </select>
                        {/* Start Date Filter */}
                        <input
                            type="date"
                            className="px-3 py-1.5 rounded-lg border border-orange-200 bg-white text-orange-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 min-w-[140px]"
                            value={hostSubsFilter.startDate}
                            onChange={e => setHostSubsFilter(f => ({ ...f, startDate: e.target.value }))}
                            max={hostSubsFilter.endDate || undefined}
                            placeholder="Start date"
                            title="Start date"
                        />
                        {/* End Date Filter */}
                        <input
                            type="date"
                            className="px-3 py-1.5 rounded-lg border border-orange-200 bg-white text-orange-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-orange-300 min-w-[140px]"
                            value={hostSubsFilter.endDate}
                            onChange={e => setHostSubsFilter(f => ({ ...f, endDate: e.target.value }))}
                            min={hostSubsFilter.startDate || undefined}
                            placeholder="End date"
                            title="End date"
                        />
                    </div>
                    <div className="rounded-2xl overflow-hidden border border-orange-100">
                        {loadingData ? (
                            <p className="p-8 text-orange-400 text-center text-lg font-semibold">Loading service fees...</p>
                        ) : filteredHosts.length === 0 ? (
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
                                        {filteredHosts.map((h, idx) => {
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
                                    {filteredHosts.map((h, idx) => {
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
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-2">
                        <div className="flex items-center gap-2">
                            <h3 className="text-2xl font-extrabold text-blue-900 px-2 sm:px-0 pt-2 pb-1 flex items-center gap-2">
                                <DollarSign className="w-7 h-7 text-blue-500" />
                                Payment History
                            </h3>
                        </div>
                        <div className="flex flex-wrap gap-2 items-center">
                            {/* Host Filter */}
                            <select
                                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[120px]"
                                value={filter.host}
                                onChange={e => { setFilter(f => ({ ...f, host: e.target.value })); setHistoryPage(1); }}
                            >
                                <option value="">All Hosts</option>
                                {hostOptions.map(h => (
                                    <option key={h.id} value={h.id}>{h.name}</option>
                                ))}
                            </select>
                            {/* Plan Filter */}
                            <select
                                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[110px]"
                                value={filter.plan}
                                onChange={e => { setFilter(f => ({ ...f, plan: e.target.value })); setHistoryPage(1); }}
                            >
                                <option value="">All Plans</option>
                                {planOptions.map(plan => (
                                    <option key={plan} value={plan}>{plan}</option>
                                ))}
                            </select>
                            {/* Status Filter */}
                            <select
                                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[110px]"
                                value={filter.status}
                                onChange={e => { setFilter(f => ({ ...f, status: e.target.value })); setHistoryPage(1); }}
                            >
                                <option value="">All Statuses</option>
                                {statusOptions.map(status => (
                                    <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>
                                ))}
                            </select>
                            {/* Start Date Filter */}
                            <input
                                type="date"
                                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[140px]"
                                value={filter.startDate}
                                onChange={e => { setFilter(f => ({ ...f, startDate: e.target.value })); setHistoryPage(1); }}
                                max={filter.endDate || undefined}
                                placeholder="Start date"
                                title="Start date"
                            />
                            {/* End Date Filter */}
                            <input
                                type="date"
                                className="px-3 py-1.5 rounded-lg border border-blue-200 bg-white text-blue-900 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[140px]"
                                value={filter.endDate}
                                onChange={e => { setFilter(f => ({ ...f, endDate: e.target.value })); setHistoryPage(1); }}
                                min={filter.startDate || undefined}
                                placeholder="End date"
                                title="End date"
                            />
                        </div>
                        <button
                            onClick={() => setPdfPreview({ open: true, type: 'paymentHistory' })}
                            className="group bg-gradient-to-r from-blue-500 to-blue-400 text-white px-5 py-2.5 rounded-xl shadow-lg font-bold text-xs sm:text-sm hover:scale-105 hover:shadow-xl transition-all flex items-center gap-2 border-2 border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-300 relative"
                            style={{ minWidth: 160 }}
                        >
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20 mr-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                            </span>
                            <span className="tracking-wide">Export as PDF</span>
                            <span className="absolute -top-2 -right-2 bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded-full shadow-md font-bold opacity-80 group-hover:opacity-100 transition">PDF</span>
                        </button>
                        {/* PDF Preview Modal for Payment History */}
                        {pdfPreview.open && pdfPreview.type === 'paymentHistory' && (
                            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
                                    <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
                                        <h3 className="text-lg sm:text-xl font-semibold text-blue-600 flex items-center gap-2">
                                            <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mr-1" />
                                            Payment History Preview
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
                                                    <th className="px-2 py-2 text-left font-bold text-blue-700">Host</th>
                                                    <th className="px-2 py-2 text-left font-bold text-blue-700">Email</th>
                                                    <th className="px-2 py-2 text-left font-bold text-blue-700">Plan</th>
                                                    <th className="px-2 py-2 text-left font-bold text-blue-700">Amount</th>
                                                    <th className="px-2 py-2 text-left font-bold text-blue-700">Paid On</th>
                                                    <th className="px-2 py-2 text-left font-bold text-blue-700">Expires On</th>
                                                    <th className="px-2 py-2 text-left font-bold text-blue-700">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredServiceFees.length === 0 ? (
                                                    <tr><td colSpan={7} className="text-center text-gray-400 py-4">No service fee payments found.</td></tr>
                                                ) : (
                                                    paginatedFees.map((fee) => {
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
                                                            <tr key={fee.id} className="border-b border-blue-50">
                                                                <td className="px-2 py-2">{host?.fullName || '-'}</td>
                                                                <td className="px-2 py-2">{host?.email || '-'}</td>
                                                                <td className="px-2 py-2">{fee.plan}</td>
                                                                <td className="px-2 py-2">₱{fee.amount}</td>
                                                                <td className="px-2 py-2">{paidOn}</td>
                                                                <td className="px-2 py-2">{expiresOn}</td>
                                                                <td className="px-2 py-2">{fee.status === 'paid' ? 'Paid' : fee.status}</td>
                                                            </tr>
                                                        );
                                                    })
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2 border-t border-gray-100">
                                        <button
                                            className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2 rounded-lg shadow transition"
                                            onClick={() => { exportPaymentHistoryPDF(); setPdfPreview({ open: false, type: null }); }}
                                            disabled={filteredServiceFees.length === 0}
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
                                {filteredServiceFees.length === 0 ? (
                                    <tr><td colSpan={7} className="text-center text-blue-400 py-8 text-lg">No service fee payments found.</td></tr>
                                ) : paginatedFees.map((fee, idx) => {
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
                                        <tr
                                            key={fee.id}
                                            className={`transition-all ${(idx % 2 === 0 ? 'bg-blue-50/60' : 'bg-white')} hover:bg-blue-100/80 border-b border-blue-100 last:border-0`}
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
                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex justify-center items-center gap-2 mt-4">
                                        <button
                                            className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-bold disabled:opacity-50"
                                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                            disabled={historyPage === 1}
                                        >
                                            Previous
                                        </button>
                                        <span className="font-semibold text-blue-900">Page {historyPage} of {totalPages}</span>
                                        <button
                                            className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-bold disabled:opacity-50"
                                            onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                            disabled={historyPage === totalPages}
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                            </tbody>
                        </table>
                        {/* Mobile stacked cards with pagination */}
                        <div className="flex flex-col gap-3 sm:hidden p-1">
                            {pagedServiceFees.length === 0 ? (
                                <div className="text-center text-blue-400 py-8 text-lg">No service fee payments found.</div>
                            ) : paginatedFees.map((fee, idx) => {
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
                            {/* Pagination Controls for mobile */}
                            {totalPages > 1 && (
                                <div className="flex justify-center items-center gap-2 mt-4">
                                    <button
                                        className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-bold disabled:opacity-50"
                                        onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                        disabled={historyPage === 1}
                                    >
                                        Previous
                                    </button>
                                    <span className="font-semibold text-blue-900">Page {historyPage} of {totalPages}</span>
                                    <button
                                        className="px-3 py-1 rounded bg-blue-100 text-blue-700 font-bold disabled:opacity-50"
                                        onClick={() => setHistoryPage(p => Math.min(totalPages, p + 1))}
                                        disabled={historyPage === totalPages}
                                    >
                                        Next
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

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


import { LayoutDashboard, Users, DollarSign, FileText, Shield, Settings, LogOut, User, Book, FileLock, FileWarning, FileCheck2, FileText as FileTextIcon, AlertTriangle, Users as UsersIcon } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc, getDocs, collection, orderBy, query, where, updateDoc, deleteDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../firebase";
import homezyLogo from "../Host View/images/homezy-logo.png";


// Place initialPolicies above the component for scope
const initialPolicies = [
    {
        id: '2',
        type: 'Rule & Regulation',
        title: 'No Smoking Policy',
        content: 'Smoking is strictly prohibited inside all properties. Violation may result in a penalty fee.'
    },
    {
        id: '3',
        type: 'Report',
        title: 'Incident Reporting',
        content: 'All incidents must be reported within 48 hours to the platform support team for proper documentation and resolution.'
    },
    {
        id: '4',
        type: 'Contract',
        title: 'Host Service Agreement',
        content: 'Hosts agree to maintain their property in accordance with platform standards and fulfill all confirmed reservations.'
    },
    {
        id: '5',
        type: 'Terms and Conditions',
        title: 'Terms and Conditions',
        content: `By using Homezy, you agree to abide by all platform rules and local laws. Users are responsible for the accuracy of their information and for maintaining the security of their accounts. Homezy reserves the right to suspend or terminate accounts for violations of these terms.`
    },
    {
        id: '6',
        type: 'Privacy Policy',
        title: 'Privacy Policy',
        content: `Homezy values your privacy. We collect only the information necessary to provide our services and do not share your personal data with third parties except as required by law. You may request deletion of your data at any time.`
    },
    {
        id: '7',
        type: 'Hosting Rules',
        title: 'Hosting Rules',
        content: `Hosts must ensure their listings are accurate and up-to-date. All properties must be clean, safe, and comply with local regulations. Discrimination of any kind is strictly prohibited.`
    },
    {
        id: '8',
        type: 'Safety Guidelines',
        title: 'Safety Guidelines',
        content: `All users should prioritize safety. Report any suspicious activity immediately. Emergency contact information must be available in every property. Follow fire and health safety protocols at all times.`
    },
    {
        id: '9',
        type: 'Community Standards',
        title: 'Community Standards',
        content: `We foster a welcoming and respectful community. Harassment, hate speech, and illegal activities are not tolerated. Treat all members with kindness and respect, both online and offline.`
    }
];

function PolicyCompliance() {
    // PDF Preview modal state
    const [pdfPreview, setPdfPreview] = useState({ open: false, policy: null });
    // State for adding a new policy
    const [newPolicy, setNewPolicy] = useState({
        title: '',
        type: '',
        content: ''
    });
    const [adding, setAdding] = useState(false);

    // Add new policy handler
    const handleAddPolicy = async (e) => {
        e.preventDefault();
        if (!newPolicy.title.trim() || !newPolicy.type.trim() || !newPolicy.content.trim()) {
            setPolicyMessage('All fields are required.');
            setTimeout(() => setPolicyMessage(''), 2000);
            return;
        }
        setAdding(true);
        try {
            // Generate a unique id (timestamp-based)
            const id = Date.now().toString();
            const policyObj = { ...newPolicy, id };
            await setDoc(doc(db, "policies", id), policyObj);
            setPolicies(prev => [...prev, policyObj]);
            setNewPolicy({ title: '', type: '', content: '' });
            setPolicyMessage('New policy added!');
            setTimeout(() => setPolicyMessage(''), 2000);
        } catch (e) {
            setPolicyMessage('Failed to add policy.');
        } finally {
            setAdding(false);
        }
    };
    // All hooks and logic must be inside this function!
    const [loadingData, setLoadingData] = useState(true);
    const [hosts, setHosts] = useState([]);
    const [guests, setGuests] = useState([]);
    const [admin, setAdmin] = useState(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [deleteModalOpen, setDeleteModalOpen] = useState(false);
    const [guestToDelete, setGuestToDelete] = useState(null);
    const [deleteError, setDeleteError] = useState("");
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteSuccess, setDeleteSuccess] = useState("");
    const dropdownRef = useRef(null);
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    // Export a single policy to PDF
    const exportPolicyPDF = (policy) => {
        const doc = new jsPDF();
        // Use a color based on type for accent
        const accentMap = {
            'Rule & Regulation': [236, 72, 153], // pink
            'Report': [251, 191, 36], // yellow
            'Contract': [20, 184, 166], // teal
            'Terms and Conditions': [34, 197, 94], // green
            'Privacy Policy': [250, 204, 21], // yellow
            'Hosting Rules': [236, 72, 153], // pink
            'Safety Guidelines': [251, 146, 60], // orange
            'Community Standards': [59, 130, 246], // blue
        };
        const accentColor = accentMap[policy.type] || [139, 92, 246];
        // Header
        doc.setFillColor(...accentColor);
        doc.rect(0, 0, 210, 28, 'F');
        doc.setFontSize(20);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(policy.title, 16, 18);
        doc.setDrawColor(...accentColor);
        doc.setLineWidth(1.2);
        doc.line(0, 28, 210, 28);
        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'normal');
        // Content
        doc.setFontSize(13);
        doc.text(`Type: ${policy.type}`, 16, 40);
        doc.setFontSize(12);
        doc.text('Content:', 16, 52);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(55, 65, 81);
        doc.text(doc.splitTextToSize(policy.content, 178), 16, 62);
        // Footer
        const pageCount = doc.internal.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            doc.setFontSize(9);
            doc.setTextColor(...accentColor);
            doc.text(`Generated: ${new Date().toLocaleDateString()} | Page ${i} of ${pageCount}`,
                105, 292, { align: 'center' });
        }
        doc.save(`${policy.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.pdf`);
    };

    // PDF Export helpers (Professional look, no logo)
    // Save policy to local state (not Firestore)
    // ...existing code...
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
            didDrawPage: (data) => { },
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
            didDrawPage: (data) => { },
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


    // --- Policy & Compliance State and Handlers (move above return for scope) ---

    // Firestore-backed policies state
    const [policies, setPolicies] = useState([]);
    const [loadingPolicies, setLoadingPolicies] = useState(true);

    // Fetch policies from Firestore on mount
    useEffect(() => {
        const fetchPolicies = async () => {
            setLoadingPolicies(true);
            try {
                const snap = await getDocs(collection(db, "policies"));
                if (!snap.empty) {
                    setPolicies(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
                } else {
                    // If no policies in Firestore, seed with initialPolicies
                    for (const p of initialPolicies) {
                        await setDoc(doc(db, "policies", p.id), p);
                    }
                    setPolicies(initialPolicies);
                }
            } catch (e) {
                setPolicies(initialPolicies);
            } finally {
                setLoadingPolicies(false);
            }
        };
        fetchPolicies();
    }, []);

    // Tabbed UI state
    const policyTabs = [
        { type: 'Terms and Conditions', label: 'Terms of Service', icon: FileLock, color: 'bg-green-100 text-green-700', key: 'terms' },
        { type: 'Privacy Policy', label: 'Privacy Policy', icon: FileTextIcon, color: 'bg-yellow-100 text-yellow-700', key: 'privacy' },
        { type: 'Hosting Rules', label: 'Hosting Rules', icon: UsersIcon, color: 'bg-pink-100 text-pink-700', key: 'hosting' },
        { type: 'Safety Guidelines', label: 'Safety Guidelines', icon: AlertTriangle, color: 'bg-orange-50 text-orange-600', key: 'safety' },
        { type: 'Community Standards', label: 'Community Standards', icon: FileCheck2, color: 'bg-blue-100 text-blue-700', key: 'community' },
    ];
    const [activeTab, setActiveTab] = useState(policyTabs[0].type);
    const [editContent, setEditContent] = useState('');
    const [policyMessage, setPolicyMessage] = useState('');
    // Set editContent only when tab changes (not on every policies change)
    useEffect(() => {
        const found = policies.find(p => p.type === activeTab);
        setEditContent(found ? found.content : '');
    }, [activeTab]);



    // Save policy to Firestore
    const handleSavePolicy = async (idx) => {
        const policy = policies[idx];
        try {
            await setDoc(doc(db, "policies", policy.id), policy);
            setPolicyMessage('Save successful!');
            setTimeout(() => setPolicyMessage(''), 2000);
        } catch (e) {
            setPolicyMessage('Failed to update policy.');
        }
    };

    // Delete policy from Firestore
    const handleDeletePolicy = async (idx) => {
        const policy = policies[idx];
        if (!window.confirm('Are you sure you want to delete this policy section?')) return;
        try {
            await deleteDoc(doc(db, "policies", policy.id));
            setPolicies(policies.filter((_, i) => i !== idx));
        } catch (e) {
            setPolicyMessage('Failed to delete policy.');
        }
    };



    // --- End Policy & Compliance State and Handlers ---

    return (
        <div className="flex min-h-screen bg-[#FFFFFF] text-[#23364A] font-sans flex-col md:flex-row overflow-x-hidden">
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
                    style={{ touchAction: 'none' }}
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

            {/* Main Content: Policy & Compliance Editor */}
            <main className="flex-1 py-8 px-2 sm:py-12 sm:px-8 lg:px-24 bg-gradient-to-br from-[#f8fafc] to-[#f3e8ff] overflow-x-hidden">
                <div className="max-w-3xl mx-auto w-full">
                    <div className="bg-white/95 shadow-2xl rounded-3xl border border-gray-100 p-4 sm:p-8 md:p-12 relative overflow-hidden">
                        <div className="absolute -top-10 -right-10 opacity-10 pointer-events-none select-none hidden xs:block">
                            <Shield className="w-40 h-40 text-orange-400" />
                        </div>
                        <h2 className="text-2xl sm:text-4xl font-extrabold text-[#0B2545] mb-6 sm:mb-8 flex items-center gap-2 sm:gap-3">
                            <FileTextIcon className="w-7 h-7 sm:w-8 sm:h-8 text-orange-500" />
                            Policy & Compliance Management
                        </h2>

                        {/* Add New Policy Form */}
                        <form onSubmit={handleAddPolicy} className="mb-8 sm:mb-10 bg-gradient-to-r from-orange-50 to-pink-50 border border-orange-200 rounded-2xl p-4 sm:p-6 shadow flex flex-col gap-3 sm:gap-4">
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                <input
                                    className="flex-1 border border-orange-300 rounded-lg px-3 py-2 text-gray-700 text-base focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                                    type="text"
                                    placeholder="Policy Title"
                                    value={newPolicy.title}
                                    onChange={e => setNewPolicy(p => ({ ...p, title: e.target.value }))}
                                    maxLength={60}
                                    required
                                />
                                <input
                                    className="flex-1 border border-orange-300 rounded-lg px-3 py-2 text-gray-700 text-base focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
                                    type="text"
                                    placeholder="Policy Type (e.g. Rule, Report)"
                                    value={newPolicy.type}
                                    onChange={e => setNewPolicy(p => ({ ...p, type: e.target.value }))}
                                    maxLength={40}
                                    required
                                />
                            </div>
                            <textarea
                                className="border border-orange-300 rounded-lg px-3 py-2 text-gray-700 text-base focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white resize-vertical min-h-[60px]"
                                placeholder="Policy Content"
                                value={newPolicy.content}
                                onChange={e => setNewPolicy(p => ({ ...p, content: e.target.value }))}
                                maxLength={1000}
                                required
                            />
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    className="bg-gradient-to-r from-orange-500 to-orange-400 hover:from-orange-600 hover:to-orange-500 text-white px-5 py-2 rounded-lg text-base font-semibold shadow transition-all duration-150 disabled:opacity-60"
                                    disabled={adding}
                                >
                                    {adding ? 'Adding...' : 'Add New Policy'}
                                </button>
                            </div>
                        </form>

                        {loadingPolicies ? (
                            <div className="text-center text-gray-400 py-10 sm:py-12 text-base sm:text-lg font-medium animate-pulse">Loading policies...</div>
                        ) : policies.length === 0 ? (
                            <div className="text-center text-gray-400 py-10 sm:py-12 text-base sm:text-lg font-medium">No policy sections available.</div>
                        ) : (
                            <div className="space-y-6 sm:space-y-8">
                                {(() => {
                                    // Color palette for cards
                                    const colorPalette = [
                                        {
                                            border: 'border-pink-400',
                                            bg: 'bg-pink-50/60',
                                            text: 'text-pink-700',
                                            icon: 'text-pink-400',
                                        },
                                        {
                                            border: 'border-yellow-400',
                                            bg: 'bg-yellow-50/60',
                                            text: 'text-yellow-700',
                                            icon: 'text-yellow-400',
                                        },
                                        {
                                            border: 'border-teal-400',
                                            bg: 'bg-teal-50/60',
                                            text: 'text-teal-700',
                                            icon: 'text-teal-400',
                                        },
                                        {
                                            border: 'border-red-400',
                                            bg: 'bg-red-50/60',
                                            text: 'text-red-700',
                                            icon: 'text-red-400',
                                        },
                                        {
                                            border: 'border-indigo-400',
                                            bg: 'bg-indigo-50/60',
                                            text: 'text-indigo-700',
                                            icon: 'text-indigo-400',
                                        },
                                        {
                                            border: 'border-cyan-400',
                                            bg: 'bg-cyan-50/60',
                                            text: 'text-cyan-700',
                                            icon: 'text-cyan-400',
                                        },
                                    ];
                                    // Icon palette for variety
                                    const iconPalette = [FileTextIcon, Shield, AlertTriangle, FileCheck2, UsersIcon, FileWarning];
                                    return policies.map((policy, idx) => {
                                        const color = colorPalette[idx % colorPalette.length];
                                        const Icon = iconPalette[idx % iconPalette.length];
                                        return (
                                            <div
                                                key={policy.id}
                                                className={`relative ${color.bg} ${color.border} border-l-4 rounded-2xl p-4 sm:p-7 shadow flex flex-col sm:flex-row sm:items-start gap-3 sm:gap-4 transition hover:shadow-lg`}
                                            >
                                                <div className="absolute -top-4 -left-4 opacity-20 pointer-events-none select-none hidden xs:block">
                                                    <Icon className={`w-12 h-12 sm:w-16 sm:h-16 ${color.icon}`} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex flex-wrap items-center gap-2 mb-2">
                                                        <span className={`font-semibold text-base sm:text-xl ${color.text}`}>{policy.title}</span>
                                                        <span className={`text-xs ${color.bg.replace('bg-', 'bg-opacity-80 ')} ${color.text} rounded px-2 py-0.5 ml-2 uppercase tracking-wide font-semibold`}>{policy.type}</span>
                                                    </div>
                                                    <textarea
                                                        className="w-full border border-gray-200 rounded-lg p-2 sm:p-3 text-gray-700 mt-1 text-base focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white resize-vertical min-h-[80px]"
                                                        rows={3}
                                                        value={policy.content}
                                                        onChange={e => {
                                                            const updated = [...policies];
                                                            updated[idx].content = e.target.value;
                                                            setPolicies(updated);
                                                        }}
                                                    />
                                                </div>
                                                <div className="flex flex-row sm:flex-col gap-2 mt-2 sm:mt-0 min-w-[90px] sm:min-w-[100px]">
                                                    <button
                                                        className="bg-gradient-to-r from-green-500 to-green-400 hover:from-green-600 hover:to-green-500 text-white px-3 py-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold shadow transition-all duration-150"
                                                        onClick={() => handleSavePolicy(idx)}
                                                    >
                                                        Save
                                                    </button>
                                                    <button
                                                        className="bg-gradient-to-r from-blue-500 to-blue-400 hover:from-blue-600 hover:to-blue-500 text-white px-3 py-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold shadow transition-all duration-150"
                                                        type="button"
                                                        onClick={() => setPdfPreview({ open: true, policy })}
                                                    >
                                                        Export PDF
                                                    </button>
                                                                {/* PDF Preview Modal for Policy Export */}
                                                                {pdfPreview.open && pdfPreview.policy && (
                                                                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
                                                                        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-0 relative border border-gray-100 mx-2 sm:mx-0 max-h-[90vh] flex flex-col">
                                                                            <div className="flex items-center justify-between px-4 sm:px-6 pt-5 pb-2 border-b border-gray-100">
                                                                                <h3 className="text-lg sm:text-xl font-semibold text-blue-600 flex items-center gap-2">
                                                                                    <FileTextIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-500 mr-1" />
                                                                                    Policy Preview
                                                                                </h3>
                                                                                <button
                                                                                    className="p-2 rounded-full hover:bg-gray-100 transition"
                                                                                    onClick={() => setPdfPreview({ open: false, policy: null })}
                                                                                    aria-label="Close"
                                                                                >
                                                                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                                                                </button>
                                                                            </div>
                                                                            <div className="px-4 sm:px-6 pt-3 pb-2 overflow-x-auto" style={{ maxHeight: '60vh' }}>
                                                                                <div className="mb-2">
                                                                                    <span className="font-bold text-lg text-blue-900">{pdfPreview.policy.title}</span>
                                                                                    <span className="ml-3 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-semibold uppercase">{pdfPreview.policy.type}</span>
                                                                                </div>
                                                                                <div className="text-gray-700 whitespace-pre-line text-base border border-gray-100 rounded-lg p-3 bg-gray-50 mb-2" style={{ minHeight: 60 }}>
                                                                                    {pdfPreview.policy.content}
                                                                                </div>
                                                                            </div>
                                                                            <div className="flex justify-end gap-2 px-4 sm:px-6 pb-5 pt-2 border-t border-gray-100">
                                                                                <button
                                                                                    className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-6 py-2 rounded-lg shadow transition"
                                                                                    onClick={() => { exportPolicyPDF(pdfPreview.policy); setPdfPreview({ open: false, policy: null }); }}
                                                                                >
                                                                                    Export to PDF
                                                                                </button>
                                                                                <button
                                                                                    className="bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold px-4 py-2 rounded-lg transition"
                                                                                    onClick={() => setPdfPreview({ open: false, policy: null })}
                                                                                >
                                                                                    Cancel
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                    <button
                                                        className="bg-gradient-to-r from-red-500 to-red-400 hover:from-red-600 hover:to-red-500 text-white px-3 py-2 sm:px-4 rounded-lg text-xs sm:text-sm font-semibold shadow transition-all duration-150"
                                                        onClick={() => handleDeletePolicy(idx)}
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        )}
                        {/* Toast/Message */}
                        {policyMessage && (
                            <div className="fixed left-1/2 top-8 z-50 transform -translate-x-1/2 animate-fade-in-up">
                                <div className={`px-6 py-3 rounded-xl shadow-lg font-semibold text-base flex items-center gap-2 ${policyMessage.toLowerCase().includes('fail') ? 'bg-red-500 text-white' : 'bg-green-500 text-white'}`}>
                                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                                    {policyMessage}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}

export default PolicyCompliance;

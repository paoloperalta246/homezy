import './App.css';
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Homepage from "./components/Guest View/Homepage";
import Homes from "./components/Guest View/Homes";
import Login from "./components/Login and Register/Login";
import Register from "./components/Login and Register/Register";
import Experiences from './components/Guest View/Experiences';
import Services from './components/Guest View/Services';
import QC from './components/Guest View/Homes (QC)';
import MM from './components/Guest View/Homes (MM)';
import CC from './components/Guest View/Homes (CC)';
import BC from './components/Guest View/Homes (BC)';
import Favorites from './components/Guest View/Favorites';
import Verified from './components/Login and Register/Verified';
import HostVerification from './components/Guest View/HostVerification';
import Calendar from './components/Host View/Calendars';
import Dashboard from './components/Host View/Dashboard';
import Listings from './components/Host View/Listings';
import Profile from './components/Host View/Profile';
import GuestProfile from './components/Guest View/GuestProfile';
import ListingDetails from './components/Guest View/ListingDetails';
import Bookings from './components/Guest View/Bookings';
import HostBookings from './components/Host View/Bookings';
import Coupons from './components/Host View/Coupons';
import GuestMessages from './components/Guest View/GuestMessages';
import HostMessage from './components/Host View/HostMessages';
import PointsRewards from './components/Host View/PointsRewards';
import Earnings from './components/Host View/Earnings';
import Compliance from './components/Guest View/Compliance';
import AdminDashboard from './components/Admin View/AdminDashboard';
import HostNotifications from './components/Host View/HostNotifications';
import GuestNotifications from './components/Guest View/GuestNotifications';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="/homes" element={<Homes />} />
        <Route path="/homes-QC" element={<QC />} />
        <Route path="/homes-MM" element={<MM />} />
        <Route path="/homes-CC" element={<CC />} />
        <Route path="/homes-BC" element={<BC />} />
        <Route path="/login" element={<Login />} />
        <Route path="/experiences" element={<Experiences />} />
        <Route path="/services" element={<Services />} />
        <Route path="/register" element={<Register />} />
        <Route path="/favorites" element={<Favorites />} />
        <Route path="/verified" element={<Verified />} />
        <Route path="/host-verification" element={<HostVerification />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/listings" element={<Listings />} />        
        <Route path="/profile" element={<Profile />} />
        <Route path="/guest-profile" element={<GuestProfile />} />
        <Route path="/listing/:listingId" element={<ListingDetails />} />
        <Route path="/bookings" element={<Bookings />} />
        <Route path="/host-bookings" element={<HostBookings />} />
        <Route path="/coupons" element={<Coupons />} />
        <Route path="/guest-messages" element={<GuestMessages />} />
        <Route path="/host-messages" element={<HostMessage />} />
        <Route path="/points-rewards" element={<PointsRewards />} />
        <Route path="/earnings" element={<Earnings />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/admin-dashboard" element={<AdminDashboard />} />
        <Route path="/host-notifications" element={<HostNotifications />} />
        <Route path="/guest-notifications" element={<GuestNotifications />} />
      </Routes>
    </Router>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import BuyerLogin from "./pages/BuyerLogin";
import BuyerDashboard from "./pages/BuyerDashboard";
import BuyerProfile from "./pages/BuyerProfile";
import CardholderLogin from "./pages/CardholderLogin";
import CardholderDashboard from "./pages/CardholderDashboard";
import CardholderProfile from "./pages/CardholderProfile";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
import { DealProvider } from "./utils/DealContext";

function App() {
  return (
    <Router>
      <DealProvider>
      <Routes>
        <Route path="/" element={<BuyerLogin />} />
       
        <Route path="/cardholder" element={<CardholderLogin />} />
        
        <Route path="/admin" element={<AdminLogin />} />

       <Route
  path="/buyer-dashboard"
  element={
    <ProtectedRoute allowedRole="buyer">
      <BuyerDashboard />
    </ProtectedRoute>
  }
/>

<Route
  path="/cardholder-dashboard"
  element={
    <ProtectedRoute allowedRole="cardholder">
      <CardholderDashboard />
    </ProtectedRoute>
  }
/>

<Route
  path="/buyer-profile"
  element={
    <ProtectedRoute allowedRole="buyer">
      <BuyerProfile />
    </ProtectedRoute>
  }
/>

<Route
  path="/cardholder-profile"
  element={
    <ProtectedRoute allowedRole="cardholder">
      <CardholderProfile />
    </ProtectedRoute>
  }
/>

<Route
  path="/admin-dashboard"
  element={
    <ProtectedRoute allowedRole="admin">
      <AdminDashboard />
    </ProtectedRoute>
  }
/>
       
      </Routes>
      {/* Toast notifications mounted here */}
      <Toaster position="top-center" />
      </DealProvider>
    </Router>
  );
}

export default App;

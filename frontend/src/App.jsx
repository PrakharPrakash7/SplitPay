import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import BuyerLogin from "./pages/BuyerLogin";
import BuyerDashboard from "./pages/BuyerDashboard";
import BuyerProfile from "./pages/BuyerProfile";
import CardholderLogin from "./pages/CardholderLogin";
import CardholderDashboard from "./pages/CardholderDashboard";
import CardholderProfile from "./pages/CardholderProfile";
import ProtectedRoute from "./components/ProtectedRoute";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BuyerLogin />} />
       
        <Route path="/cardholder" element={<CardholderLogin />} />

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
       
      </Routes>
      {/* Toast notifications mounted here */}
      <Toaster position="top-center" />
    </Router>
  );
}

export default App;

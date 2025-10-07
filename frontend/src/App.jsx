import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

import BuyerLogin from "./pages/BuyerLogin";
import BuyerDashboard from "./pages/BuyerDashboard";
import CardholderLogin from "./pages/CardholderLogin";
import CardholderDashboard from "./pages/CardholderDashboard";
import ProtectedRoute from "./components/ProtectedRoute";
function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BuyerLogin />} />
       
        <Route path="/cardholder" element={<CardholderLogin />} />

       <Route
  path="/buyer-dashboard"
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
       
      </Routes>
      {/* Toast notifications mounted here */}
      <ToastContainer position="top-center" autoClose={3000} />
    </Router>
  );
}

export default App;

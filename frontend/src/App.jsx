import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

import BuyerLogin from "./pages/BuyerLogin";
import BuyerDashboard from "./pages/BuyerDashboard";
import CardholderLogin from "./pages/CardholderLogin";
import CardholderDashboard from "./pages/CardholderDashboard";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<BuyerLogin />} />
        <Route path="/buyer-dashboard" element={<BuyerDashboard />} />
        <Route path="/cardholder" element={<CardholderLogin />} />
        <Route path="/cardholder-dashboard" element={<CardholderDashboard />} />
      </Routes>
      {/* Toast notifications mounted here */}
      <ToastContainer position="top-center" autoClose={3000} />
    </Router>
  );
}

export default App;

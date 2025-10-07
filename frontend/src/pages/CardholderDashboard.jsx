const CardholderDashboard = () => {
  const handleLogout = () => {
    localStorage.removeItem("token");
    window.location.href = "/cardholder";
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-100 text-gray-900">
      <h1 className="text-3xl font-bold mb-6">Cardholder Dashboard</h1>
      <p>Welcome, view pending orders or make payments here.</p>
      <button
        onClick={handleLogout}
        className="mt-4 bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
      >
        Logout
      </button>
    </div>
  );
};

export default CardholderDashboard;

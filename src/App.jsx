import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import AuthProvider from './contexts/AuthContext';
import Layout from './layouts/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import AdminDashboard from './pages/AdminDashboard';
import FacultyDashboard from './pages/FacultyDashboard';
import { 
  ProtectedRoute, 
  TeamRoute, 
  FacultyRoute, 
  AdminRoute, 
  PublicOnlyRoute,
  PublicRoute,
  UnauthorizedPage 
} from './components/ProtectedRoute';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route element={<Layout />}>
            {/* Public routes */}
            <Route 
              path="/" 
              element={
                <PublicRoute>
                  <Landing />
                </PublicRoute>
              } 
            />
            
            {/* Auth routes - only accessible when not logged in */}
            <Route 
              path="/login" 
              element={
                <PublicOnlyRoute>
                  <Login />
                </PublicOnlyRoute>
              } 
            />
            <Route 
              path="/register" 
              element={
                <PublicOnlyRoute>
                  <Register />
                </PublicOnlyRoute>
              } 
            />
            
            {/* Protected dashboard routes */}
            <Route 
              path="/dashboard" 
              element={
                <TeamRoute>
                  <Dashboard />
                </TeamRoute>
              } 
            />
            <Route 
              path="/faculty" 
              element={
                <FacultyRoute>
                  <FacultyDashboard />
                </FacultyRoute>
              } 
            />
            <Route 
              path="/admin" 
              element={
                <AdminRoute>
                  <AdminDashboard />
                </AdminRoute>
              } 
            />
            
            {/* Unauthorized page */}
            <Route path="/unauthorized" element={<UnauthorizedPage />} />
            
            {/* Catch-all redirect to home */}
            <Route path="*" element={<Landing />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;

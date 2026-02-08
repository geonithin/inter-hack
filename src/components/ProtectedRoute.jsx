import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

// Loading component for auth state
const AuthLoading = () => (
  <div className="min-h-screen flex items-center justify-center bg-white">
    <div className="text-center space-y-4">
      <div className="w-8 h-8 border-4 border-oxford border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="text-oxford font-semibold text-sm">Checking access...</p>
    </div>
  </div>
);

// Base ProtectedRoute component
export const ProtectedRoute = ({ 
  children, 
  requiredRole = null,
  fallbackPath = '/login',
  requireAuth = true 
}) => {
  const { loading, initialized, isAuthenticated, canAccess } = useAuth();
  const location = useLocation();

  // Show loading while auth is being initialized
  if (!initialized || loading) {
    return <AuthLoading />;
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !isAuthenticated()) {
    return <Navigate 
      to={fallbackPath} 
      state={{ from: location.pathname }}
      replace 
    />;
  }

  // If specific role is required, check permission
  if (requiredRole && !canAccess(requiredRole)) {
    // Redirect based on what they don't have access to
    if (!isAuthenticated()) {
      return <Navigate 
        to="/login" 
        state={{ from: location.pathname }}
        replace 
      />;
    }
    
    // User is authenticated but doesn't have the right role
    return <Navigate 
      to="/unauthorized" 
      state={{ 
        from: location.pathname,
        requiredRole,
        message: `Access denied. This page requires ${requiredRole} privileges.`
      }}
      replace 
    />;
  }

  return children;
};

// Specific route guards for different roles
export const TeamRoute = ({ children }) => (
  <ProtectedRoute requiredRole="lead">
    {children}
  </ProtectedRoute>
);

export const FacultyRoute = ({ children }) => (
  <ProtectedRoute requiredRole="faculty">
    {children}
  </ProtectedRoute>
);

export const AdminRoute = ({ children }) => (
  <ProtectedRoute requiredRole="admin">
    {children}
  </ProtectedRoute>
);

// Public route that redirects authenticated users to their dashboard
export const PublicOnlyRoute = ({ children }) => {
  const { loading, initialized, isAuthenticated, getUserRole, isLoggingOut } = useAuth();
  const location = useLocation();

  // Show loading while auth is being initialized
  if (!initialized || loading) {
    return <AuthLoading />;
  }

  // Prevent redirect during logout to avoid race condition
  if (isLoggingOut) {
    console.log('PublicOnlyRoute: Logout in progress, showing public content');
    return children;
  }

  // If user is authenticated, redirect to appropriate dashboard
  if (isAuthenticated()) {
    const role = getUserRole();
    const from = location.state?.from;
    
    console.log('PublicOnlyRoute: User is authenticated with role:', role);
    
    // If they were trying to access a specific page, redirect there
    if (from) {
      return <Navigate to={from} replace />;
    }
    
    // Otherwise redirect based on role
    switch (role) {
      case 'faculty':
      case 'admin':
        return <Navigate to="/faculty" replace />;
      case 'lead':
      default:
        return <Navigate to="/dashboard" replace />;
    }
  }

  console.log('PublicOnlyRoute: User is not authenticated, showing public content');
  return children;
};

// Route that allows both authenticated and unauthenticated users (like Landing)
export const PublicRoute = ({ children }) => {
  const { loading, initialized } = useAuth();

  // Show loading while auth is being initialized
  if (!initialized || loading) {
    return <AuthLoading />;
  }

  return children;
};

// Unauthorized page component
export const UnauthorizedPage = () => {
  const { isAuthenticated, getUserRole } = useAuth();
  const location = useLocation();
  
  const message = location.state?.message || 'You are not authorized to access this page.';
  const requiredRole = location.state?.requiredRole;
  const userRole = getUserRole();

  const handleGoToDashboard = () => {
    const role = getUserRole();
    
    switch (role) {
      case 'faculty':
      case 'admin':
        return '/faculty';
      case 'lead':
      default:
        return '/dashboard';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="space-y-2">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Access Denied</h1>
          <p className="text-gray-600">{message}</p>
        </div>
        
        {requiredRole && userRole && (
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <p className="text-gray-700">
              <span className="font-semibold">Required:</span> {requiredRole} access
            </p>
            <p className="text-gray-700">
              <span className="font-semibold">Your role:</span> {userRole}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {isAuthenticated() ? (
            <button
              onClick={() => window.location.href = handleGoToDashboard()}
              className="w-full bg-oxford hover:bg-oxford/90 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Go to Dashboard
            </button>
          ) : (
            <button
              onClick={() => window.location.href = '/login'}
              className="w-full bg-oxford hover:bg-oxford/90 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Sign In
            </button>
          )}
          
          <button
            onClick={() => window.location.href = '/'}
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProtectedRoute;
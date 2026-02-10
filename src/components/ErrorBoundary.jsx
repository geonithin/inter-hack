import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError() {
        // Update state so the next render will show the fallback UI.
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        // Log the error to console and any error reporting service
        console.error('ErrorBoundary caught an error:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            // Custom error UI
            return (
                <div className="min-h-screen bg-linear-to-br from-gray-50 to-oxford/5 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border-4 border-red-100 p-8 max-w-md w-full text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        
                        <h2 className="text-2xl font-black text-red-600 mb-4 uppercase tracking-wider">
                            Something went wrong
                        </h2>
                        
                        <p className="text-gray-600 mb-8 leading-relaxed">
                            The application encountered an unexpected error. This has been logged and will be investigated.
                        </p>

                        {/* Error details for development */}
                        {import.meta.env.DEV && this.state.error && (
                            <details className="text-left bg-gray-50 p-4 rounded-lg mb-6 text-xs">
                                <summary className="font-bold cursor-pointer mb-2 text-red-600">
                                    Error Details (Development)
                                </summary>
                                <pre className="whitespace-pre-wrap text-gray-700">
                                    {this.state.error && this.state.error.toString()}
                                    <br />
                                    {this.state.errorInfo.componentStack}
                                </pre>
                            </details>
                        )}

                        <div className="space-y-4">
                            <button 
                                onClick={() => window.location.reload()}
                                className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-6 rounded-xl transition-all duration-200 flex items-center justify-center gap-2 active:scale-95"
                            >
                                <RefreshCw className="w-5 h-5" />
                                Reload Application
                            </button>
                            
                            <button 
                                onClick={() => window.history.back()}
                                className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold py-3 px-6 rounded-xl transition-all duration-200 active:scale-95"
                            >
                                Go Back
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
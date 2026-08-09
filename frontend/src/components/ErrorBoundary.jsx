import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center bg-background text-text-main">
                    <AlertOctagon className="w-16 h-16 text-red-500 mb-6" />
                    <h2 className="text-3xl font-bold mb-4">Something went wrong</h2>
                    <p className="text-text-muted max-w-md mx-auto mb-8">
                        The application encountered an unexpected error. Please refresh the page to try again.
                    </p>
                    <button 
                        onClick={() => window.location.reload()}
                        className="flex items-center gap-2 bg-white/5 hover:bg-white/10 text-white font-medium py-3 px-8 rounded-lg transition-colors border border-white/10"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Reload Page
                    </button>
                    {process.env.NODE_ENV === 'development' && (
                        <div className="mt-8 p-4 bg-red-500/10 border border-red-500/20 rounded text-left overflow-auto max-w-2xl w-full text-red-400 font-mono text-sm">
                            {this.state.error && this.state.error.toString()}
                        </div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;

import React from 'react';
import Button from '../../components/ui/Button';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
        this.setState({ errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="p-8 text-white bg-red-900/20 border border-red-500 rounded-xl m-4">
                    <h2 className="text-xl font-bold mb-4">Algo deu errado na interface.</h2>
                    <p className="mb-2">Erro: {this.state.error?.toString()}</p>
                    <details className="text-xs text-slate-300 whitespace-pre-wrap">
                        {this.state.errorInfo?.componentStack}
                    </details>
                    <div className="mt-4">
                        <Button onClick={() => window.location.reload()}>Recarregar Página</Button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

export default ErrorBoundary;

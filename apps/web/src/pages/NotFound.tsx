import React from 'react';
import { Link } from 'react-router-dom';
import { Hexagon, ArrowLeft } from 'lucide-react';

const NotFound: React.FC = () => {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 text-center">
      <Hexagon className="h-12 w-12 text-primary/30 mb-4" strokeWidth={1} />
      <h1 className="text-4xl font-bold font-mono text-foreground mb-2">404</h1>
      <p className="text-sm text-muted-foreground mb-6">This node doesn't exist in the graph.</p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-emerald-glow transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to origin
      </Link>
    </div>
  );
};

export default NotFound;

import { FileWarning } from 'lucide-react';
import type { BrowserAction, RuntimeState } from '../shared/types';

export default function PageError({ runtime, action }: { runtime: RuntimeState; action: (action: BrowserAction) => void }) {
  const error = runtime.pageError;
  if (!error) return null;
  return <section className="page-error" role="alert">
    <FileWarning size={32} aria-hidden="true" />
    <h2>This page couldn’t open</h2>
    <p>{error.message}</p>
    <p className="page-error-address">{error.url}</p>
    <code>{error.code}</code>
    <div className="page-error-actions">
      <button className="button primary" onClick={() => action('reload')}>Reload page</button>
      {runtime.canGoBack && <button className="button secondary" onClick={() => action('back')}>Go back</button>}
    </div>
  </section>;
}

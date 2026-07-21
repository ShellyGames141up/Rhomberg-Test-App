import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch() {
    // Production monitoring may replace this with a sanitised correlation event.
    console.error('Rhomberg app rendering error');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="app-state-view">
        <section className="app-state-card is-error">
          <span className="state-error-mark">!</span>
          <h1>The screen could not be displayed</h1>
          <p role="alert">Your saved test data has not been cleared. Reload the app and try that action again.</p>
          <button className="primary-button" type="button" onClick={() => window.location.reload()}>Reload app <span>→</span></button>
        </section>
      </main>
    );
  }
}

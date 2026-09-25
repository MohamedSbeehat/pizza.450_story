import { Component } from 'react';

/**
 * Keeps the film running when part of the 3D fails on a device (for example
 * a GPU that can't run a post-processing effect): the failing part is
 * replaced by `fallback` instead of taking the whole scene down.
 */
export class SafeBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error) {
    console.warn(`[3D] ${this.props.name || 'part'} disabled:`, error?.message || error);
    this.props.onError?.(error);
  }

  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children;
  }
}

'use client';

import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ChunkErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Detect ChunkLoadError by name or message
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      /loading chunk/i.test(error.message) ||
      /loading css chunk/i.test(error.message);
    return { hasError: isChunkError };
  }

  componentDidCatch(error: Error) {
    const isChunkError =
      error.name === 'ChunkLoadError' ||
      /loading chunk/i.test(error.message) ||
      /loading css chunk/i.test(error.message);

    if (isChunkError) {
      // Hard reload clears the stale chunk references
      window.location.reload();
    }
  }

  render() {
    // While reload is in flight, show nothing rather than a broken UI
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

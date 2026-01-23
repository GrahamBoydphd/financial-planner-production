'use client';

import Layout from '@/components/Layout';

export default function ImprovePage() {
  return (
    <Layout>
      <div className="h-[calc(100vh-8rem)] w-full bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
        <iframe
          src="https://docs.google.com/forms/d/e/1FAIpQLSdWQuCqhkYkBs7XvqmoZJ3XsN8zH_05Y7Gp9LFkyTSrzSYZrQ/viewform?embedded=true"
          width="100%"
          height="100%"
          frameBorder="0"
          title="Feedback Form"
        >
          Loading…
        </iframe>
      </div>
    </Layout>
  );
}

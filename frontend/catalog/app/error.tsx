"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="loading-page"><h1>Something went wrong.</h1><p>Please try loading the catalog again.</p><button className="primary" onClick={reset}>Try again</button></main>;
}

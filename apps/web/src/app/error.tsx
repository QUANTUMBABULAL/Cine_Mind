"use client";

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <span aria-hidden className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-coral/15 text-xl text-coral">
        !
      </span>
      <h1 className="heading mb-2 text-2xl">Something went wrong</h1>
      <p className="mb-6 text-sm text-muted">
        {error.message.includes("Cannot reach")
          ? "The CineMind API is not responding. Start the backend (npm run api) and try again."
          : error.message}
      </p>
      <button onClick={reset} className="btn-primary">
        Try again
      </button>
    </div>
  );
}

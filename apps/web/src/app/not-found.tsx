import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <p className="heading mb-2 text-5xl text-accent">404</p>
      <h1 className="heading mb-2 text-2xl">Not found</h1>
      <p className="mb-6 text-sm text-muted">This page or record does not exist in the CineMind database.</p>
      <Link href="/" className="btn-primary">
        Back to Discover
      </Link>
    </div>
  );
}

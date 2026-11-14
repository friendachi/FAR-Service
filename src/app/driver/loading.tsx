export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-md bg-line" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-56 animate-pulse rounded-xl bg-line/60" />
        ))}
      </div>
    </div>
  );
}

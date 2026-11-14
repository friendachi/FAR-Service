export function PageFallback() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-md bg-line" />
      <div className="mt-6 h-64 animate-pulse rounded-xl bg-line/60" />
    </div>
  );
}

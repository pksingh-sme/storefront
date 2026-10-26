export default function Loading() {
  return (
    <div className="container-page py-14" role="status" aria-label="Loading">
      <div className="h-10 w-64 animate-pulse bg-cream" />
      <div className="mt-10 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i}>
            <div className="aspect-[4/5] animate-pulse bg-cream" />
            <div className="mt-4 h-4 w-3/4 animate-pulse bg-cream" />
            <div className="mt-2 h-4 w-1/3 animate-pulse bg-cream" />
          </div>
        ))}
      </div>
    </div>
  );
}

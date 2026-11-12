export default function RouteFallback() {
  return (
    <div className="route-fallback" role="status" aria-label="Loading">
      <span className="route-fallback__spinner" />
    </div>
  );
}

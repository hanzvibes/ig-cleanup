export function AppSkeleton() {
  return (
    <section className="appSkeleton" data-testid="boot-skeleton" aria-label="Restoring local data">
      <div className="skeletonProfile">
        <span className="skeletonCircle" />
        <div className="skeletonStats">
          <span />
          <span />
          <span />
        </div>
      </div>
      <span className="skeletonLine skeletonLineWide" />
      <span className="skeletonLine skeletonLineMedium" />
      <div className="skeletonPanel">
        <span className="skeletonLine skeletonLineSmall" />
        <span className="skeletonNumber" />
        <span className="skeletonLine skeletonLineMedium" />
      </div>
      <div className="skeletonRows">
        {Array.from({ length: 4 }, (_, index) => (
          <div className="skeletonRow" key={index}>
            <span className="skeletonCircle skeletonCircleSmall" />
            <span className="skeletonLine skeletonLineRow" />
            <span className="skeletonButton" />
          </div>
        ))}
      </div>
    </section>
  );
}

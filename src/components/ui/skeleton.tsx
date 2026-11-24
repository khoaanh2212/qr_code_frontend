/**
 * A placeholder block while content loads. Hidden from assistive technology: the region that holds
 * skeletons sets `aria-busy` and announces the loading state once, in words.
 */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded-sm bg-foreground/8 motion-reduce:animate-none ${className}`} />;
}

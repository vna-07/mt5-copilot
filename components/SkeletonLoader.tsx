export default function SkeletonLoader() {
  return (
    <div className="space-y-3 animate-in fade-in duration-300">
      {/* Chart Card Skeleton */}
      <div className="bento">
        <div className="flex justify-between items-start mb-3">
          <div className="space-y-2">
            <div className="h-5 w-20 rounded-md skeleton-box" />
            <div className="h-3 w-28 rounded-md skeleton-box" />
          </div>
          <div className="h-6 w-16 rounded-lg skeleton-box" />
        </div>
        
        {/* Ghost Candles */}
        <div className="h-[260px] rounded-xl skeleton-box flex items-end justify-center gap-2 pb-4 opacity-50">
          <div className="w-3 h-16 bg-white/10 rounded-sm" />
          <div className="w-3 h-24 bg-white/10 rounded-sm" />
          <div className="w-3 h-12 bg-white/10 rounded-sm" />
          <div className="w-3 h-32 bg-white/10 rounded-sm" />
          <div className="w-3 h-20 bg-white/10 rounded-sm" />
        </div>

        {/* 2x2 Grid Skeleton */}
        <div className="grid grid-cols-2 gap-2 mt-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="tile h-[88px] flex flex-col justify-between">
              <div className="h-2 w-12 rounded skeleton-box" />
              <div className="h-6 w-20 rounded-md skeleton-box" />
              <div className="h-2 w-16 rounded skeleton-box" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
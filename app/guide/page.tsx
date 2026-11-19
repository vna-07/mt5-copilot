export default function GuidePage() {
  return (
    <main className="ambient mx-auto max-w-md pb-28 px-3 pt-6">
      <h1 className="text-xl font-bold text-slate-50 mb-4">MT5 Mobile Basics</h1>
      
      <div className="bento space-y-4">
        <div>
          <p className="text-xs font-bold text-violet-300">1. Finding a Pair</p>
          <p className="text-sm text-slate-300 mt-1">Tap <b>Quotes</b> at the bottom. Tap the + icon and type the pair (e.g., EURUSD).</p>
        </div>
        <div>
          <p className="text-xs font-bold text-violet-300">2. Placing an Order</p>
          <p className="text-sm text-slate-300 mt-1">Tap the pair → <b>New Order</b>. Enter your Lot Size, SL, and TP in the boxes provided. Tap <b>Buy</b> or <b>Sell</b>.</p>
        </div>
        <div>
          <p className="text-xs font-bold text-violet-300">3. Managing the Trade</p>
          <p className="text-sm text-slate-300 mt-1">Go to the <b>Trade</b> tab at the bottom. Press and hold your open position to Modify or Close it.</p>
        </div>
      </div>
    </main>
  );
}
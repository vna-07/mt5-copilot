export interface ExplainerItem {
  id: string;
  simpleTitle: string;
  proTerm: string;
  oneLiner: string;
  howItHelpsHer: string;
}

export const BEGINNER_EXPLAINERS: ExplainerItem[] = [
  { id: "candles", simpleTitle: "Green & Red Bars", proTerm: "OHLC Candlesticks", oneLiner: "Green means price went up; red means it went down.", howItHelpsHer: "See who is winning now and where price bounced before." },
  { id: "sl_tp", simpleTitle: "Safety Net & Cash-Out", proTerm: "Stop-Loss & Take-Profit", oneLiner: "Pre-set lines close a trade at a small loss or profit goal.", howItHelpsHer: "Your worst-case loss is capped before you enter." },
  { id: "lot_size", simpleTitle: "Trade Size", proTerm: "Lot Size", oneLiner: "Controls how much money each price step is worth.", howItHelpsHer: "The app sizes this to keep one bad trade within your chosen risk." },
  { id: "spread", simpleTitle: "Broker Entry Fee", proTerm: "Bid/Ask Spread", oneLiner: "The cost gap the broker charges when you open.", howItHelpsHer: "A large fee makes a trade more expensive, especially at night or during news." },
  { id: "leverage_margin", simpleTitle: "Security Deposit & Buying Power", proTerm: "Margin & Leverage", oneLiner: "Margin is held temporarily; leverage lets a small balance control more value.", howItHelpsHer: "You can see whether enough free account cash remains before opening." },
  { id: "market_mood", simpleTitle: "Market Mood & Buyer Pressure", proTerm: "ADX & Flow Pressure", oneLiner: "Shows strong, sideways or jumpy markets and which side is pushing harder.", howItHelpsHer: "Avoid messy markets where beginners are commonly stopped out." },
];

export function buildPlainEnglishMarketStory(params: {
  symbol: string;
  regime: "TRENDING" | "RANGING" | "CHAOTIC";
  tickBuyPressurePct: number;
  spreadSource: "LIVE" | "ESTIMATED";
  spreadToAtrPct: number;
  marginSafe: boolean;
}) {
  const { symbol, regime, tickBuyPressurePct, spreadSource, spreadToAtrPct, marginSafe } = params;
  const moodText = regime === "TRENDING"
    ? `${symbol} is moving in a clear, steady direction right now.`
    : regime === "RANGING"
    ? `${symbol} is bouncing sideways between a floor and a ceiling.`
    : `${symbol} is jumpy and unpredictable right now.`;
  const flowText = tickBuyPressurePct >= 58
    ? `Buyers are pushing harder (${tickBuyPressurePct}% upward pressure).`
    : tickBuyPressurePct <= 42
    ? `Sellers are pushing harder (${100 - tickBuyPressurePct}% downward pressure).`
    : `Buyers and sellers are fairly evenly matched (${tickBuyPressurePct}% upward pressure).`;
  const costText = spreadToAtrPct <= 15
    ? `The broker entry fee looks healthy (${spreadToAtrPct}% of normal candle movement, ${spreadSource.toLowerCase()}).`
    : `Warning: the broker entry fee is expensive (${spreadToAtrPct}% of normal candle movement).`;
  return {
    headline: regime === "CHAOTIC" ? "Wait & Watch - Jumpy Market" : `${symbol} Plain-English Snapshot`,
    body: `${moodText} ${flowText}`,
    safetyNote: marginSafe
      ? "There is plenty of free account safety buffer for this trade size."
      : "This trade uses too much of your account deposit. Lower the risk or choose a smaller trade.",
    costText,
  };
}

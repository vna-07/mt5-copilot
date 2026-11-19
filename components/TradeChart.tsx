"use client";
import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/types";

export default function TradeChart({ candles, entry, sl, tp1, tp2, id }: { 
  candles: Candle[]; entry: number; sl: number; tp1: number; tp2: number; id: string;
}) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let disposed = false;
    let chart: any = null;

    (async () => {
      const { createChart, CandlestickSeries, LineStyle } = await import("lightweight-charts");
      if (disposed || !box.current) return;

      chart = createChart(box.current, {
        height: 260,
        layout: { background: { color: "transparent" }, textColor: "#94a3b8", fontSize: 10 },
        grid: { vertLines: { color: "rgba(255,255,255,0.03)" }, horzLines: { color: "rgba(255,255,255,0.03)" } },
        rightPriceScale: { borderColor: "rgba(255,255,255,0.1)" },
        timeScale: { borderColor: "rgba(255,255,255,0.1)", timeVisible: true, secondsVisible: false },
        crosshair: { mode: 0 },
      });

      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#10b981", downColor: "#fb7185", borderVisible: false, wickUpColor: "#10b981", wickDownColor: "#fb7185",
      });

      series.setData(candles.map((c) => ({
        time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close,
      })));

      const drawLine = (price: number, color: string, title: string) =>
        series.createPriceLine({ price, color, title, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true });

      drawLine(entry, "#c4b5fd", "ENTRY");
      drawLine(sl, "#fb7185", "SL");
      drawLine(tp1, "#10b981", "TP1");
      drawLine(tp2, "#34d399", "TP2");

      chart.timeScale().fitContent();
    })();

    return () => { disposed = true; if (chart) chart.remove(); };
  }, [id, candles, entry, sl, tp1, tp2]);

  return <div ref={box} className="w-full overflow-hidden rounded-xl mt-2" />;
}
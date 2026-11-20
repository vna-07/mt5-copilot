"use client";
import { useEffect, useRef, useState } from "react";
import type { Candle } from "@/lib/types";

export default function TradeChart({ candles, entry, sl, tp1, tp2, id, overlays }: {
  candles: Candle[]; entry: number; sl: number; tp1: number; tp2: number; id: string;
  overlays?: { e20: number[]; e50: number[]; e200: number[]; vwap: number[]; upperVwapBand: number[]; lowerVwapBand: number[] };
}) {
  const box = useRef<HTMLDivElement>(null);
  const [crosshair, setCrosshair] = useState<Candle | null>(null);

  useEffect(() => {
    let disposed = false;
    let chart: any = null;

    (async () => {
      const { createChart, CandlestickSeries, LineSeries, LineStyle } = await import("lightweight-charts");
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

      const addLine = (values: number[] | undefined, color: string, title: string) => {
        if (!values?.length) return;
        const line = chart.addSeries(LineSeries, { color, lineWidth: 1, title, lastValueVisible: false, priceLineVisible: false });
        line.setData(values.map((value, i) => ({ time: candles[i]?.time as any, value })).filter((p) => p.time));
      };
      addLine(overlays?.e20, "#c4b5fd", "20 Fair Value");
      addLine(overlays?.e50, "#60a5fa", "50 Fair Value");
      addLine(overlays?.e200, "#f59e0b", "200 Fair Value");
      addLine(overlays?.vwap, "#2dd4bf", "Fair Value Average");
      addLine(overlays?.upperVwapBand, "rgba(45,212,191,0.35)", "+2 Range");
      addLine(overlays?.lowerVwapBand, "rgba(45,212,191,0.35)", "-2 Range");

      const drawLine = (price: number, color: string, title: string) =>
        series.createPriceLine({ price, color, title, lineWidth: 2, lineStyle: LineStyle.Dashed, axisLabelVisible: true });

      drawLine(entry, "#c4b5fd", "Your Entry");
      drawLine(sl, "#fb7185", "Safety Net");
      drawLine(tp1, "#10b981", "Cash-Out 1");
      drawLine(tp2, "#34d399", "Cash-Out 2");

      chart.subscribeCrosshairMove((param: any) => {
        if (!param?.time) { setCrosshair(null); return; }
        const candle = candles.find((c) => c.time === param.time);
        setCrosshair(candle ?? null);
      });

      chart.timeScale().fitContent();
    })();

    return () => { disposed = true; if (chart) chart.remove(); };
  }, [id, candles, entry, sl, tp1, tp2, overlays]);

  const selected = crosshair ?? candles[candles.length - 1];
  return (
    <div>
      <div ref={box} className="w-full overflow-hidden rounded-xl mt-2" />
      {selected && (
        <div className="mt-2 grid grid-cols-4 gap-1 text-[9px]">
          {[
            ["O", selected.open],
            ["H", selected.high],
            ["L", selected.low],
            ["C", selected.close],
          ].map(([label, value]) => (
            <div key={String(label)} className="rounded-lg bg-white/5 px-2 py-1.5 text-center text-slate-300">
              <span className="text-slate-500">{label}</span> <span className="num">{Number(value).toFixed(5)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
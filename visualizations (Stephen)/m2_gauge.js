document.addEventListener("DOMContentLoaded", function () {
  d3.csv("m2_liquidity_gauge.csv", d3.autoType)
    .then(drawM2Gauge)
    .catch(err => {
      console.error("Error loading m2_liquidity_gauge.csv:", err);
      const cap = document.getElementById("m2-gauge-caption");
      if (cap) cap.textContent = "Error: could not load M2 liquidity data.";
    });
});

function drawM2Gauge(data) {
  const clean = data.filter(d => typeof d.m2_growth === "number" && !isNaN(d.m2_growth));
  if (!clean.length) return;

  const latest = clean[clean.length - 1];

  const minG = d3.min(clean, d => d.m2_growth);
  const maxG = d3.max(clean, d => d.m2_growth);

  const pctScale = d3.scaleLinear()
    .domain([minG, maxG])
    .nice()
    .range([0, 100]);

  let valuePct = pctScale(latest.m2_growth);
  valuePct = Math.max(0, Math.min(100, valuePct));

  const width = 480;
  const height = 260;
  const radius = 170;
  const centerX = width / 2;
  const centerY = height * 0.9;

  const container = d3.select("#m2-gauge");
  container.selectAll("*").remove();

  const svg = container.append("svg")
    .attr("width", width)
    .attr("height", height);

  // index 0–100 → angle -90° to +90°
  const angleScale = d3.scaleLinear()
    .domain([0, 100])
    .range([-Math.PI / 2, Math.PI / 2]);

  const regimes = [
    { label: "Contraction", start: 0,  end: 25, color: "#ef4444" },
    { label: "Neutral",     start: 25, end: 50, color: "#eab308" },
    { label: "Growth",      start: 50, end: 75, color: "#4ade80" },
    { label: "Expansion",   start: 75, end: 100, color: "#22c55e" }
  ];

  // Colored bands
  regimes.forEach(r => {
    const arc = d3.arc()
      .innerRadius(radius * 0.65)
      .outerRadius(radius)
      .startAngle(angleScale(r.start))
      .endAngle(angleScale(r.end));

    svg.append("path")
      .attr("d", arc())
      .attr("transform", `translate(${centerX},${centerY})`)
      .attr("fill", r.color)
      .attr("opacity", 0.9);
  });

  // Inner dark arc
  const innerArc = d3.arc()
    .innerRadius(radius * 0.65)
    .outerRadius(radius * 0.67)
    .startAngle(-Math.PI / 2)
    .endAngle(Math.PI / 2);

  svg.append("path")
    .attr("d", innerArc())
    .attr("transform", `translate(${centerX},${centerY})`)
    .attr("fill", "#020617");

  // Needle
  const needleAngle = angleScale(valuePct);
  const needleLen = radius * 0.8;

  svg.append("line")
    .attr("x1", centerX)
    .attr("y1", centerY)
    .attr("x2", centerX)
    .attr("y2", centerY - needleLen)
    .attr("stroke", "#ffffff")
    .attr("stroke-width", 4)
    .attr("stroke-linecap", "round")
    .attr("transform", `rotate(${needleAngle * 180 / Math.PI},${centerX},${centerY})`);

  // Center circle + value
  svg.append("circle")
    .attr("cx", centerX)
    .attr("cy", centerY)
    .attr("r", 18)
    .attr("fill", "#020617")
    .attr("stroke", "#1f2937");

  svg.append("text")
    .attr("x", centerX)
    .attr("y", centerY + 4)
    .attr("text-anchor", "middle")
    .attr("font-size", "12px")
    .attr("font-weight", "bold")
    .attr("fill", "#ffffff")
    .text(latest.m2_growth.toFixed(1) + "%");

  // Title above the gauge
  svg.append("text")
    .attr("x", centerX)
    .attr("y", centerY - radius - 16)
    .attr("text-anchor", "middle")
    .attr("font-size", "13px")
    .attr("fill", "#cbd5e1")
    .text("Current Liquidity Regime");

  // LEGEND
  const legendDiv = d3.select("#m2-gauge-legend");
  legendDiv.selectAll("*").remove();

  const legendSvg = legendDiv.append("svg")
    .attr("width", 420)
    .attr("height", 40);

  const legendGroup = legendSvg.append("g")
    .attr("transform", "translate(10,10)");

  regimes.forEach((r, i) => {
    const group = legendGroup.append("g")
      .attr("transform", `translate(${i * 105}, 0)`);

    group.append("rect")
      .attr("width", 18)
      .attr("height", 18)
      .attr("rx", 4)
      .attr("ry", 4)
      .attr("fill", r.color)
      .attr("stroke", "#1f2937");

    group.append("text")
      .attr("x", 26)
      .attr("y", 13)
      .attr("fill", "#e5e7eb")
      .attr("font-size", "13px")
      .text(r.label);
  });

  // Caption under chart
  const cap = document.getElementById("m2-gauge-caption");
  if (cap) {
    const env = latest.liquidity_environment || "Unknown";
    cap.textContent =
      `As of ${latest.date}, M2 is growing at ${latest.m2_growth.toFixed(1)}% and we classify ` +
      `the liquidity environment as "${env}".`;
  }
}

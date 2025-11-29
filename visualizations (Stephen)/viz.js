// Shared tooltip helpers
const tooltip = d3.select("#tooltip");

function showTooltip(html, event) {
  tooltip
    .style("display", "block")
    .html(html)
    .style("left", (event.pageX + 10) + "px")
    .style("top", (event.pageY + 10) + "px");
}

function hideTooltip() {
  tooltip.style("display", "none");
}

// =====================================================================
// 1) Macro Liquidity vs RWA TVL (dual-axis line chart with zoom + legend toggle + clip)
// =====================================================================
d3.csv("viz1_macro_vs_rwa.csv").then(raw => {
  // Parse + sort
  const data = raw.map(d => ({
    date: new Date(d.date),
    rwa_tvl: +d.rwa_tvl,
    total_stablecoin_mcap: +d.total_stablecoin_mcap,
    treasury_yield: +d.treasury_yield,
    m2_supply: +d.m2_supply
  })).sort((a, b) => a.date - b.date);

  const svg = d3.select("#viz1");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 24, right: 70, bottom: 40, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Root group (for axes + legend)
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ---- CLIP PATH so lines / circles / overlay can't cover axes ----
  svg.append("defs")
    .append("clipPath")
    .attr("id", "clip-viz1")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  // Plot group: all data elements live here, clipped
  const plot = g.append("g")
    .attr("clip-path", "url(#clip-viz1)");

  // ---- Scales ----
  const xOriginal = d3.scaleTime()
    .domain(d3.extent(data, d => d.date))
    .range([0, innerWidth]);

  const x = xOriginal.copy(); // zoomable version

  const yLeft = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.rwa_tvl) * 1.1])
    .range([innerHeight, 0]);

  const yRight = d3.scaleLinear()
    .domain([0, d3.max(data, d => d.total_stablecoin_mcap) * 1.1])
    .range([innerHeight, 0]);

  // ---- Line generators (use zoomable x) ----
  const lineRWA = d3.line()
    .x(d => x(d.date))
    .y(d => yLeft(d.rwa_tvl))
    .curve(d3.curveMonotoneX);

  const lineStable = d3.line()
    .x(d => x(d.date))
    .y(d => yRight(d.total_stablecoin_mcap))
    .curve(d3.curveMonotoneX);

  // ---- Formatting helpers (B instead of G) ----
  const axisFmt = d => {
    const s = d3.format(".2s")(d);
    return "$" + s.replace("G", "B");
  };
  const tipFmt = d => {
    const s = d3.format(".3s")(d);
    return "$" + s.replace("G", "B");
  };
  const fmtDate = d3.timeFormat("%Y-%m-%d");

  // ---- Axes (NOT clipped) ----
  const xAxisGroup = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "axis x-axis")
    .call(d3.axisBottom(x));

  const yLeftAxisGroup = g.append("g")
    .attr("class", "axis y-axis-left")
    .call(d3.axisLeft(yLeft).ticks(6).tickFormat(axisFmt));

  yLeftAxisGroup.append("text")
    .attr("x", -40)
    .attr("y", -10)
    .attr("fill", "#e5e7eb")
    .attr("text-anchor", "start")
    .text("RWA TVL (USD)");

  const yRightAxisGroup = g.append("g")
    .attr("class", "axis y-axis-right")
    .attr("transform", `translate(${innerWidth},0)`)
    .call(d3.axisRight(yRight).ticks(6).tickFormat(axisFmt));

  yRightAxisGroup.append("text")
    .attr("x", 40)
    .attr("y", -10)
    .attr("fill", "#e5e7eb")
    .attr("text-anchor", "end")
    .text("Total stablecoin mcap (USD)");

  // ---- Lines (CLIPPED) ----
  const rwaPath = plot.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#60a5fa")
    .attr("stroke-width", 2)
    .attr("d", lineRWA);

  const stablePath = plot.append("path")
    .datum(data)
    .attr("fill", "none")
    .attr("stroke", "#fbbf24")
    .attr("stroke-width", 2)
    .attr("d", lineStable);

  // ---- Hover line & circles (also clipped) ----
  const focusLine = plot.append("line")
    .attr("stroke", "#e5e7eb")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3")
    .style("opacity", 0)
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const focusCircleRWA = plot.append("circle")
    .attr("r", 4)
    .attr("fill", "#60a5fa")
    .style("opacity", 0);

  const focusCircleStable = plot.append("circle")
    .attr("r", 4)
    .attr("fill", "#fbbf24")
    .style("opacity", 0);

  const bisectDate = d3.bisector(d => d.date).left;

  // ---- Legend toggle state (legend outside clip) ----
  let showRWA = true;
  let showStable = true;

  const legendItems = [
    { id: "rwa", label: "RWA TVL", color: "#60a5fa" },
    { id: "stable", label: "Total stablecoin mcap", color: "#fbbf24" }
  ];

  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerWidth - 210}, -4)`);

  const legendGroups = legend.selectAll("g")
    .data(legendItems)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 18})`)
    .style("cursor", "pointer")
    .on("click", (event, d) => {
      if (d.id === "rwa") {
        showRWA = !showRWA;
        rwaPath.style("opacity", showRWA ? 1 : 0);
      } else if (d.id === "stable") {
        showStable = !showStable;
        stablePath.style("opacity", showStable ? 1 : 0);
      }

      // dim legend color when hidden
      legendGroups.select("rect")
        .attr("fill-opacity", item => {
          if (item.id === "rwa") return showRWA ? 1 : 0.3;
          if (item.id === "stable") return showStable ? 1 : 0.3;
          return 1;
        });
    });

  legendGroups.each(function(d) {
    const lg = d3.select(this);
    lg.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", d.color);
    lg.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .attr("fill", "#e5e7eb")
      .text(d.label);
  });

  // ---- Hover handler ----
  function updateHover(event) {
    const [mx] = d3.pointer(event, this);
    const x0 = x.invert(mx);
    const idx = bisectDate(data, x0, 1);
    const d0 = data[idx - 1] || data[0];
    const d1 = data[idx] || data[data.length - 1];
    const d = x0 - d0.date > d1.date - x0 ? d1 : d0;

    const anyVisible = (showRWA || showStable);

    focusLine
      .attr("x1", x(d.date))
      .attr("x2", x(d.date))
      .style("opacity", anyVisible ? 1 : 0);

    focusCircleRWA
      .attr("cx", x(d.date))
      .attr("cy", yLeft(d.rwa_tvl))
      .style("opacity", showRWA ? 1 : 0);

    focusCircleStable
      .attr("cx", x(d.date))
      .attr("cy", yRight(d.total_stablecoin_mcap))
      .style("opacity", showStable ? 1 : 0);

    const rows = [`<strong>${fmtDate(d.date)}</strong>`];
    if (showRWA) {
      rows.push(`RWA TVL: ${tipFmt(d.rwa_tvl)}`);
    }
    if (showStable) {
      rows.push(`Stablecoins: ${tipFmt(d.total_stablecoin_mcap)}`);
    }
    rows.push(`Yield: ${d.treasury_yield.toFixed(2)}%`);
    rows.push(`M2: ${tipFmt(d.m2_supply)}`);

    showTooltip(rows.join("<br/>"), event);
  }

  // ---- Zoom / pan (horizontal) ----
  function zoomed(event) {
    const transform = event.transform;
    const zx = transform.rescaleX(xOriginal);
    x.domain(zx.domain());

    // update axes
    xAxisGroup.call(d3.axisBottom(x));

    // update lines
    rwaPath.attr("d", lineRWA);
    stablePath.attr("d", lineStable);

    // hide hover visuals until next mousemove
    focusLine.style("opacity", 0);
    focusCircleRWA.style("opacity", 0);
    focusCircleStable.style("opacity", 0);
    hideTooltip();
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 20])
    .translateExtent([[0, 0], [innerWidth, innerHeight]])
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("zoom", zoomed);

  // Transparent overlay for hover + zoom/pan (inside clipped plot)
  const overlay = plot.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", updateHover)
    .on("mouseleave", () => {
      focusLine.style("opacity", 0);
      focusCircleRWA.style("opacity", 0);
      focusCircleStable.style("opacity", 0);
      hideTooltip();
    })
    .call(zoom);

  // Optional: double-click to reset zoom
  overlay.on("dblclick", () => {
    svg.transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity);
  });
});



// =====================================================================
// 2) Capital Allocation by Asset Type (100% stacked area with focus + zoom + clip)
// =====================================================================
d3.csv("viz2_asset_type_shares.csv").then(raw => {
  // Parse numeric fields
  raw.forEach(d => {
    d.tvl = +d.tvl;      // underlying TVL (USD)
    d.share = +d.share;  // fraction of total RWA TVL on that date
  });

  // Fixed order for stack & legend
  const allTypes = Array.from(new Set(raw.map(d => d.asset_type)));
  const assetTypes = ["Diversified", "Private Credit", "Treasury"]
    .filter(t => allTypes.includes(t));

  // Wide table: one row per date, columns = asset type shares + total TVL
  const wide = Array.from(
    d3.group(raw, d => d.date),
    ([date, values]) => {
      const row = { date: new Date(date) };
      assetTypes.forEach(t => (row[t] = 0));
      row.total_tvl = d3.sum(values, v => v.tvl);
      values.forEach(v => {
        row[v.asset_type] = v.share;
      });
      return row;
    }
  ).sort((a, b) => a.date - b.date);

  const svg = d3.select("#viz2");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 24, right: 190, bottom: 40, left: 60 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // Root group (for axes + legend)
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // --- CLIP PATH so areas can’t cover axes ---
  svg.append("defs")
    .append("clipPath")
    .attr("id", "clip-viz2")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  // Plot group: all data shapes live here, inside the clipped region
  const plot = g.append("g")
    .attr("clip-path", "url(#clip-viz2)");

  // Scales
  const xOriginal = d3.scaleTime()
    .domain(d3.extent(wide, d => d.date))
    .range([0, innerWidth]);

  const x = xOriginal.copy(); // zoomable version

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([innerHeight, 0]);

  // Colors
  const color = d3.scaleOrdinal()
    .domain(assetTypes)
    .range([
      "#60a5fa", // Diversified
      "#f59e0b", // Private Credit
      "#ef4444"  // Treasury
    ]);

  const stack = d3.stack().keys(assetTypes);
  const series = stack(wide);

  const area = d3.area()
    .x(d => x(d.data.date))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveMonotoneX);

  // Axes (NOT clipped)
  const xAxisGroup = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "axis")
    .call(d3.axisBottom(x));

  g.append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(y)
        .ticks(5)
        .tickFormat(d3.format(".0%"))
    )
    .append("text")
    .attr("x", -40)
    .attr("y", -10)
    .attr("fill", "#e5e7eb")
    .attr("text-anchor", "start")
    .text("Share of RWA TVL");

  // Areas (CLIPPED, so they never cover axes)
  const layers = plot.selectAll(".layer")
    .data(series)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => color(d.key))
    .attr("fill-opacity", 0.85)
    .attr("stroke", "#050816")
    .attr("stroke-width", 0.4)
    .attr("d", area);

  // Crosshair (also clipped to plot area)
  const crosshair = plot.append("line")
    .attr("stroke", "#e5e7eb")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3")
    .style("opacity", 0)
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const bisectDate = d3.bisector(d => d.date).left;
  const fmtDate = d3.timeFormat("%Y-%m-%d");
  const tipDollar = v => {
    const s = d3.format(".3s")(v);
    return "$" + s.replace("G", "B");
  };

  // --- Legend in right margin (not clipped) ---
  let activeType = null;

  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerWidth + 12}, 6)`);

  const legendGroups = legend.selectAll("g")
    .data(assetTypes)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 18})`)
    .style("cursor", "pointer")
    .on("click", (event, type) => {
      activeType = activeType === type ? null : type;
      layers.attr("fill-opacity", d =>
        activeType && d.key !== activeType ? 0.2 : 0.85
      );
    });

  legendGroups.each(function(type) {
    const lg = d3.select(this);
    lg.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", color(type));
    lg.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .attr("fill", "#e5e7eb")
      .text(type);
  });

  // --- Hover + tooltip (overlay is clipped with plot) ---
  function handleHover(event) {
    const [mx] = d3.pointer(event, this);
    const xDate = x.invert(mx);
    const idx = bisectDate(wide, xDate);
    const row = wide[Math.max(0, Math.min(wide.length - 1, idx))];

    crosshair
      .attr("x1", x(row.date))
      .attr("x2", x(row.date))
      .style("opacity", 1);

    const total = row.total_tvl || 0;
    const lines = [
      `<strong>${fmtDate(row.date)}</strong>`,
      `Total RWA TVL: ${tipDollar(total)}`
    ];

    assetTypes.forEach(t => {
      const val = row[t] || 0;
      lines.push(`${t}: ${(val * 100).toFixed(1)}% of RWA TVL`);
    });

    showTooltip(lines.join("<br/>"), event);
  }

  // --- Zoom behaviour (horizontal only) ---
  function zoomed(event) {
    const transform = event.transform;
    const zx = transform.rescaleX(xOriginal);
    x.domain(zx.domain());

    xAxisGroup.call(d3.axisBottom(x));
    layers.attr("d", area);

    crosshair.style("opacity", 0);
    hideTooltip();
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [innerWidth, innerHeight]])
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("zoom", zoomed);

  // Overlay that sits on top of plot but inside clip
  const overlay = plot.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", handleHover)
    .on("mouseleave", () => {
      crosshair.style("opacity", 0);
      hideTooltip();
    })
    .call(zoom);

  // Double-click to reset zoom
  overlay.on("dblclick", () => {
    svg.transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity);
  });
});

// =====================================================================
// 3) Chain Allocation Over Time (stacked area by chain TVL with zoom + focus + clip)
// =====================================================================
d3.csv("viz3_chain_allocation.csv").then(raw => {
  raw.forEach(d => {
    d.tvl = +d.tvl;
    d.share_within_chains = +d.share_within_chains; // not used, but fine to keep
  });

  // pick top 6 chains by max TVL
  const tvlByChain = Array.from(
    d3.rollup(raw, v => d3.max(v, d => d.tvl), d => d.chain),
    ([chain, maxTvl]) => ({ chain, maxTvl })
  ).sort((a, b) => d3.descending(a.maxTvl, b.maxTvl));

  const chains = tvlByChain.slice(0, 6).map(d => d.chain);
  const filtered = raw.filter(d => chains.includes(d.chain));

  // wide format: one row per date, columns = chain TVLs + total
  const wide = Array.from(
    d3.group(filtered, d => d.date),
    ([date, values]) => {
      const row = { date: new Date(date) };
      chains.forEach(c => (row[c] = 0));
      values.forEach(d => {
        row[d.chain] = d.tvl;
      });
      row.total_tvl = d3.sum(chains, c => row[c]);
      return row;
    }
  ).sort((a, b) => a.date - b.date);

  const svg = d3.select("#viz3");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 24, right: 190, bottom: 40, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  // root group for axes + legend
  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // ---- CLIP PATH so areas stay inside frame ----
  svg.append("defs")
    .append("clipPath")
    .attr("id", "clip-viz3")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  // plot group (clipped)
  const plot = g.append("g")
    .attr("clip-path", "url(#clip-viz3)");

  // ---- Scales ----
  const xOriginal = d3.scaleTime()
    .domain(d3.extent(wide, d => d.date))
    .range([0, innerWidth]);

  const x = xOriginal.copy(); // zoomable

  const y = d3.scaleLinear()
    .domain([0, d3.max(wide, d => d.total_tvl) * 1.1])
    .range([innerHeight, 0]);

  const axisFmt = d => {
    const s = d3.format(".2s")(d);
    return "$" + s.replace("G", "B");
  };
  const tipFmt = d => {
    const s = d3.format(".3s")(d);
    return "$" + s.replace("G", "B");
  };
  const fmtDate = d3.timeFormat("%Y-%m-%d");

  const color = d3.scaleOrdinal()
    .domain(chains)
    .range(d3.schemeTableau10.slice(0, chains.length));

  const stack = d3.stack().keys(chains);
  const series = stack(wide);

  const area = d3.area()
    .x(d => x(d.data.date))
    .y0(d => y(d[0]))
    .y1(d => y(d[1]))
    .curve(d3.curveMonotoneX);

  // ---- Axes (not clipped) ----
  const xAxisGroup = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "axis")
    .call(d3.axisBottom(x));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(axisFmt))
    .append("text")
    .attr("x", -40)
    .attr("y", -10)
    .attr("fill", "#e5e7eb")
    .attr("text-anchor", "start")
    .text("RWA TVL (USD)");

  // ---- Stacked areas (clipped) ----
  const layers = plot.selectAll(".layer")
    .data(series)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => color(d.key))
    .attr("fill-opacity", 0.9)
    .attr("stroke", "#050816")
    .attr("stroke-width", 0.4)
    .attr("d", area);

  // ---- Crosshair (also clipped) ----
  const crosshair = plot.append("line")
    .attr("stroke", "#e5e7eb")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3")
    .style("opacity", 0)
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const bisectDate = d3.bisector(d => d.date).left;

  // ---- Legend with focus mode ----
  let activeChain = null; // null = show all

  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerWidth + 12}, 6)`);

  const legendGroups = legend.selectAll("g")
    .data(chains)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 18})`)
    .style("cursor", "pointer")
    .on("click", (event, chain) => {
      activeChain = activeChain === chain ? null : chain;
      layers.attr("fill-opacity", d =>
        activeChain && d.key !== activeChain ? 0.15 : 0.9
      );
    });

  legendGroups.each(function(chain) {
    const lg = d3.select(this);
    lg.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", color(chain));
    lg.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .attr("fill", "#e5e7eb")
      .text(chain);
  });

  // ---- Hover handler (overlay, not the paths) ----
  function handleHover(event) {
    const [mx] = d3.pointer(event, this);
    const xDate = x.invert(mx);
    const idx = bisectDate(wide, xDate);
    const row = wide[Math.max(0, Math.min(wide.length - 1, idx))];

    crosshair
      .attr("x1", x(row.date))
      .attr("x2", x(row.date))
      .style("opacity", 1);

    const total = row.total_tvl || 0;
    const lines = [
      `<strong>${fmtDate(row.date)}</strong>`,
      `Total TVL: ${tipFmt(total)}`
    ];

    chains.forEach(c => {
      const val = row[c] || 0;
      const share = total > 0 ? (val / total) * 100 : 0;
      lines.push(`${c}: ${tipFmt(val)} (${share.toFixed(1)}%)`);
    });

    showTooltip(lines.join("<br/>"), event);
  }

  // ---- Zoom / pan (horizontal only) ----
  function zoomed(event) {
    const transform = event.transform;
    const zx = transform.rescaleX(xOriginal);
    x.domain(zx.domain());

    xAxisGroup.call(d3.axisBottom(x));
    layers.attr("d", area);

    crosshair.style("opacity", 0);
    hideTooltip();
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [innerWidth, innerHeight]])
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("zoom", zoomed);

  // ---- Overlay inside clip for hover + zoom + reset ----
  const overlay = plot.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", handleHover)
    .on("mouseleave", () => {
      crosshair.style("opacity", 0);
      hideTooltip();
    })
    .call(zoom);

  // Double-click to reset zoom
  overlay.on("dblclick", () => {
    svg.transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity);
  });
});

// =====================================================================
// 4) Protocol Concentration
// =====================================================================

// A) Time series (top)
d3.csv("viz4_protocol_timeseries.csv").then(raw => {
  raw.forEach(d => {
    d.date = new Date(d.date);
    d.tvl = +d.tvl;
  });

  const protocols = Array.from(new Set(raw.map(d => d.protocol)));

  // Per-protocol series (for drawing lines)
  const byProtocol = Array.from(
    d3.group(raw, d => d.protocol),
    ([key, values]) => ({
      key,
      values: values.sort((a, b) => a.date - b.date)
    })
  );

  // Wide format by date (for crosshair + multi-protocol tooltip)
  const wide = Array.from(
    d3.group(raw, d => d.date.getTime()),
    ([ts, values]) => {
      const date = new Date(+ts);
      const row = { date };
      protocols.forEach(p => (row[p] = 0));
      values.forEach(v => {
        row[v.protocol] = v.tvl;
      });
      row.total_tvl = d3.sum(protocols, p => row[p]);
      return row;
    }
  ).sort((a, b) => a.date - b.date);

  const svg = d3.select("#viz4_ts");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 24, right: 190, bottom: 40, left: 70 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // --- clip path so lines stay inside plotting area ---
  svg.append("defs")
    .append("clipPath")
    .attr("id", "clip-viz4-ts")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  const plot = g.append("g")
    .attr("clip-path", "url(#clip-viz4-ts)");

  const xOriginal = d3.scaleTime()
    .domain(d3.extent(wide, d => d.date))
    .range([0, innerWidth]);

  const x = xOriginal.copy(); // zoomable

  const y = d3.scaleLinear()
    .domain([0, d3.max(raw, d => d.tvl) * 1.1])
    .range([innerHeight, 0]);

  const axisFmtDollar = v => {
    const s = d3.format(".2s")(v);
    return "$" + s.replace("G", "B");
  };
  const tipFmt = v => {
    const s = d3.format(".3s")(v);
    return "$" + s.replace("G", "B");
  };
  const fmtDate = d3.timeFormat("%Y-%m-%d");

  const color = d3.scaleOrdinal()
    .domain(protocols)
    .range(d3.schemeTableau10.slice(0, protocols.length));

  const line = d3.line()
    .x(d => x(d.date))
    .y(d => y(d.tvl))
    .curve(d3.curveMonotoneX);

  // Axes (not clipped)
  const xAxisGroup = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "axis")
    .call(d3.axisBottom(x));

  g.append("g")
    .attr("class", "axis")
    .call(d3.axisLeft(y).ticks(6).tickFormat(axisFmtDollar))
    .append("text")
    .attr("x", -40)
    .attr("y", -10)
    .attr("fill", "#e5e7eb")
    .attr("text-anchor", "start")
    .text("Protocol TVL (USD)");

  // Lines (clipped)
  const lines = plot.selectAll(".protocol-line")
    .data(byProtocol)
    .enter()
    .append("path")
    .attr("class", "protocol-line")
    .attr("fill", "none")
    .attr("stroke", d => color(d.key))
    .attr("stroke-width", 1.7)
    .attr("d", d => line(d.values));

  // Crosshair (clipped)
  const crosshair = plot.append("line")
    .attr("stroke", "#e5e7eb")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3")
    .style("opacity", 0)
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const bisectDate = d3.bisector(d => d.date).left;

  // Legend focus state
  let activeProtocol = null;

  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerWidth + 12}, 4)`);

  const legendGroups = legend.selectAll("g")
    .data(protocols)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 16})`)
    .style("cursor", "pointer")
    .on("click", (event, protocol) => {
      activeProtocol = activeProtocol === protocol ? null : protocol;
      lines.attr("stroke-opacity", d =>
        activeProtocol && d.key !== activeProtocol ? 0.15 : 1
      );
      // bars defined later; guard in case they don't exist yet
      if (typeof bars !== "undefined") {
        bars.attr("fill-opacity", d =>
          activeProtocol && d.protocol !== activeProtocol ? 0.25 : 0.9
        );
      }
    });

  legendGroups.each(function(d) {
    const lg = d3.select(this);
    lg.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", color(d));
    lg.append("text")
      .attr("x", 14)
      .attr("y", 9)
      .attr("fill", "#e5e7eb")
      .text(d);
  });

  // Hover handler (overlay – multi-protocol tooltip)
  function handleHover(event) {
    const [mx] = d3.pointer(event, this);
    const xDate = x.invert(mx);
    const idx = bisectDate(wide, xDate);
    const row = wide[Math.max(0, Math.min(wide.length - 1, idx))];

    crosshair
      .attr("x1", x(row.date))
      .attr("x2", x(row.date))
      .style("opacity", 1);

    const total = row.total_tvl || 0;
    const linesHtml = [
      `<strong>${fmtDate(row.date)}</strong>`,
      `Total protocol TVL: ${tipFmt(total)}`
    ];

    protocols.forEach(p => {
      const val = row[p] || 0;
      const share = total > 0 ? (val / total) * 100 : 0;
      linesHtml.push(
        `${p}: ${tipFmt(val)} (${share.toFixed(1)}%)`
      );
    });

    showTooltip(linesHtml.join("<br/>"), event);
  }

  // Zoom behaviour (x only)
  function zoomed(event) {
    const transform = event.transform;
    const zx = transform.rescaleX(xOriginal);
    x.domain(zx.domain());

    xAxisGroup.call(d3.axisBottom(x));
    lines.attr("d", d => line(d.values));

    crosshair.style("opacity", 0);
    hideTooltip();
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 12])
    .translateExtent([[0, 0], [innerWidth, innerHeight]])
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("zoom", zoomed);

  // Overlay rectangle for hover + zoom + pan
  const overlay = plot.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", handleHover)
    .on("mouseleave", () => {
      crosshair.style("opacity", 0);
      hideTooltip();
    })
    .call(zoom);

  // Double-click reset zoom
  overlay.on("dblclick", () => {
    svg.transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity);
  });

  // ===================================================================
  // B) Latest snapshot bar (bottom)
  // ===================================================================
  d3.csv("viz4_protocol_latest.csv").then(rawLatest => {
    rawLatest.forEach(d => {
      d.tvl = +d.tvl;
      d.share_of_rwa = +d.share_of_rwa;
    });

    const svgBar = d3.select("#viz4_bar");
    const widthBar = +svgBar.attr("width");
    const heightBar = +svgBar.attr("height");
    const marginBar = { top: 20, right: 20, bottom: 60, left: 90 };

    const innerWidthBar = widthBar - marginBar.left - marginBar.right;
    const innerHeightBar = heightBar - marginBar.top - marginBar.bottom;

    const gBar = svgBar.append("g")
      .attr("transform", `translate(${marginBar.left},${marginBar.top})`);

    const data = rawLatest.sort((a, b) => d3.descending(a.tvl, b.tvl));

    const xBar = d3.scaleBand()
      .domain(data.map(d => d.protocol))
      .range([0, innerWidthBar])
      .padding(0.2);

    const yBar = d3.scaleLinear()
      .domain([0, d3.max(data, d => d.tvl) * 1.1])
      .range([innerHeightBar, 0]);

    gBar.append("g")
      .attr("transform", `translate(0,${innerHeightBar})`)
      .attr("class", "axis")
      .call(d3.axisBottom(xBar))
      .selectAll("text")
      .attr("transform", "rotate(-30)")
      .style("text-anchor", "end");

    gBar.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(yBar).ticks(6).tickFormat(axisFmtDollar));

    const totalLatest = d3.sum(data, d => d.tvl);

    // bars (shared variable so legend focus can change opacity)
    bars = gBar.selectAll("rect")
      .data(data)
      .enter()
      .append("rect")
      .attr("x", d => xBar(d.protocol))
      .attr("y", d => yBar(d.tvl))
      .attr("width", xBar.bandwidth())
      .attr("height", d => innerHeightBar - yBar(d.tvl))
      .attr("fill", d => color(d.protocol))
      .attr("fill-opacity", 0.9)
      .on("mousemove", (event, d) => {
        const share = totalLatest > 0 ? (d.tvl / totalLatest) * 100 : 0;
        showTooltip(
          `<strong>${d.protocol}</strong><br/>
           TVL: ${tipFmt(d.tvl)}<br/>
           Share of these protocols: ${share.toFixed(1)}%<br/>
           Share of RWA: ${(d.share_of_rwa * 100).toFixed(1)}%`,
          event
        );
      })
      .on("mouseleave", hideTooltip);
  });
});

// =====================================================================
// 5) Yield vs RWA Asset Composition
// Same stacked area as Viz2, with U.S. 10Y Treasury yield line overlay
// =====================================================================
Promise.all([
  d3.csv("viz2_asset_type_shares.csv"),
  d3.csv("viz5_yield_timeseries.csv")
]).then(([rawShares, rawYield]) => {

  // Parse numeric fields in shares
  rawShares.forEach(d => {
    d.tvl = +d.tvl;      // underlying TVL (USD)
    d.share = +d.share;  // fraction of total RWA TVL on that date
  });

  // Map: date string -> yield_10y
  rawYield.forEach(d => {
    d.yield_10y = +d.yield_10y;
  });
  const yieldByDate = new Map(
    rawYield.map(d => [d.date, d.yield_10y])
  );

  // Fixed order for stack & legend
  const allTypes = Array.from(new Set(rawShares.map(d => d.asset_type)));
  const assetTypes = ["Diversified", "Private Credit", "Treasury"]
    .filter(t => allTypes.includes(t));

  // Wide table: one row per date, columns = asset type shares + total TVL + yield
  const wide = Array.from(
    d3.group(rawShares, d => d.date),
    ([date, values]) => {
      const row = { date: new Date(date) };
      assetTypes.forEach(t => (row[t] = 0));
      row.total_tvl = d3.sum(values, v => v.tvl);
      values.forEach(v => {
        row[v.asset_type] = v.share;
      });
      row.yield_10y = yieldByDate.get(date) ?? null;
      return row;
    }
  ).sort((a, b) => a.date - b.date);

  // --- SVG + layout for viz5 ---
  const svg = d3.select("#viz5");
  const width = +svg.attr("width");
  const height = +svg.attr("height");
  const margin = { top: 24, right: 190, bottom: 40, left: 60 };

  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const g = svg.append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // --- CLIP PATH (same idea as viz2) ---
  svg.append("defs")
    .append("clipPath")
    .attr("id", "clip-viz5")
    .append("rect")
    .attr("x", 0)
    .attr("y", 0)
    .attr("width", innerWidth)
    .attr("height", innerHeight);

  const plot = g.append("g")
    .attr("clip-path", "url(#clip-viz5)");

  // --- SCALES ---
  const xOriginal = d3.scaleTime()
    .domain(d3.extent(wide, d => d.date))
    .range([0, innerWidth]);

  const x = xOriginal.copy(); // zoomable version

  // Left axis: shares (0–1)
  const yShare = d3.scaleLinear()
    .domain([0, 1])
    .range([innerHeight, 0]);

  // Right axis: yields (in %)
  const maxYield = d3.max(wide, d => d.yield_10y || 0) || 0;
  const yYield = d3.scaleLinear()
    .domain([0, maxYield * 1.1])
    .range([innerHeight, 0]);

  const color = d3.scaleOrdinal()
    .domain(assetTypes)
    .range([
      "#60a5fa", // Diversified
      "#f59e0b", // Private Credit
      "#ef4444"  // Treasury
    ]);

  const stack = d3.stack().keys(assetTypes);
  const series = stack(wide);

  const area = d3.area()
    .x(d => x(d.data.date))
    .y0(d => yShare(d[0]))
    .y1(d => yShare(d[1]))
    .curve(d3.curveMonotoneX);

  const lineYield = d3.line()
    .x(d => x(d.date))
    .y(d => yYield(d.yield_10y))
    .defined(d => d.yield_10y != null)
    .curve(d3.curveMonotoneX);

  // --- AXES (not clipped) ---
  const xAxisGroup = g.append("g")
    .attr("transform", `translate(0,${innerHeight})`)
    .attr("class", "axis")
    .call(d3.axisBottom(x));

  g.append("g")
    .attr("class", "axis")
    .call(
      d3.axisLeft(yShare)
        .ticks(5)
        .tickFormat(d3.format(".0%"))
    )
    .append("text")
    .attr("x", -40)
    .attr("y", -10)
    .attr("fill", "#e5e7eb")
    .attr("text-anchor", "start")
    .text("Share of RWA TVL");

  // Right axis for yield
  const fmtYield = d => d.toFixed(2) + "%";

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(${innerWidth}, 0)`)
    .call(d3.axisRight(yYield).ticks(5).tickFormat(fmtYield));

  // --- AREAS (CLIPPED) ---
  const layers = plot.selectAll(".layer")
    .data(series)
    .enter()
    .append("path")
    .attr("class", "layer")
    .attr("fill", d => color(d.key))
    .attr("fill-opacity", 0.85)
    .attr("stroke", "#050816")
    .attr("stroke-width", 0.4)
    .attr("d", area);

  // --- YIELD LINE (CLIPPED) ---
  const yieldPath = plot.append("path")
    .datum(wide.filter(d => d.yield_10y != null))
    .attr("fill", "none")
    .attr("stroke", "#16a34a")
    .attr("stroke-width", 1.8)
    .attr("stroke-opacity", 0.95)
    .attr("d", lineYield);

  // --- CROSSHAIR ---
  const crosshair = plot.append("line")
    .attr("stroke", "#e5e7eb")
    .attr("stroke-width", 1)
    .attr("stroke-dasharray", "3,3")
    .style("opacity", 0)
    .attr("y1", 0)
    .attr("y2", innerHeight);

  const bisectDate = d3.bisector(d => d.date).left;
  const fmtDate = d3.timeFormat("%Y-%m-%d");
  const tipDollar = v => {
    const s = d3.format(".3s")(v);
    return "$" + s.replace("G", "B");
  };

  // --- LEGEND (asset types + yield) ---
  let activeType = null;

  const legendItems = [
    ...assetTypes.map(t => ({ label: t, color: color(t), isYield: false })),
    { label: "10Y Yield", color: "#16a34a", isYield: true }
  ];

  const legend = g.append("g")
    .attr("class", "legend")
    .attr("transform", `translate(${innerWidth + 50}, 6)`);

  const legendGroups = legend.selectAll("g")
    .data(legendItems)
    .enter()
    .append("g")
    .attr("transform", (d, i) => `translate(0, ${i * 18})`)
    .style("cursor", d => d.isYield ? "default" : "pointer")
    .on("click", (event, item) => {
      if (item.isYield) return; // do not toggle yield line
      const type = item.label;
      activeType = activeType === type ? null : type;
      layers.attr("fill-opacity", d =>
        activeType && d.key !== activeType ? 0.2 : 0.85
      );
    });

  legendGroups.each(function(d) {
    const lg = d3.select(this);
    lg.append("rect")
      .attr("width", 10)
      .attr("height", 10)
      .attr("fill", d.color);
    lg.append("text")
      .attr("x", 16)
      .attr("y", 9)
      .attr("fill", "#e5e7eb")
      .text(d.label);
  });

  // --- HOVER + TOOLTIP ---
  function handleHover(event) {
    const [mx] = d3.pointer(event, this);
    const xDate = x.invert(mx);
    const idx = bisectDate(wide, xDate);
    const row = wide[Math.max(0, Math.min(wide.length - 1, idx))];

    crosshair
      .attr("x1", x(row.date))
      .attr("x2", x(row.date))
      .style("opacity", 1);

    const lines = [
      `<strong>${fmtDate(row.date)}</strong>`,
      row.yield_10y != null ? `10Y yield: ${fmtYield(row.yield_10y)}` : "10Y yield: n/a",
      ""
    ];

    const total = row.total_tvl || 0;
    lines.push(`Total RWA TVL: ${tipDollar(total)}`);

    assetTypes.forEach(t => {
      const val = row[t] || 0;
      lines.push(`${t}: ${(val * 100).toFixed(1)}% of RWA TVL`);
    });

    showTooltip(lines.join("<br/>"), event);
  }

  // --- ZOOM (horizontal only, same as viz2, but also update yieldPath) ---
  function zoomed(event) {
    const transform = event.transform;
    const zx = transform.rescaleX(xOriginal);
    x.domain(zx.domain());

    xAxisGroup.call(d3.axisBottom(x));
    layers.attr("d", area);
    yieldPath.attr("d", lineYield);

    crosshair.style("opacity", 0);
    hideTooltip();
  }

  const zoom = d3.zoom()
    .scaleExtent([1, 8])
    .translateExtent([[0, 0], [innerWidth, innerHeight]])
    .extent([[0, 0], [innerWidth, innerHeight]])
    .on("zoom", zoomed);

  const overlay = plot.append("rect")
    .attr("width", innerWidth)
    .attr("height", innerHeight)
    .attr("fill", "transparent")
    .on("mousemove", handleHover)
    .on("mouseleave", () => {
      crosshair.style("opacity", 0);
      hideTooltip();
    })
    .call(zoom);

  overlay.on("dblclick", () => {
    svg.transition()
      .duration(300)
      .call(zoom.transform, d3.zoomIdentity);
  });
});

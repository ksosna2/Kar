/* ============================================================
   kar-3d.js — reusable CSS-3D glass icon factory
   ------------------------------------------------------------
   Usage:
     <span class="kar3d" data-obj="finance"></span>
     KAR3D.mount();                       // hydrate all [data-obj]
     KAR3D.build("gym");                  // -> DOM node (manual)

   Objects: finance gym supplements band water creator goals
            progress macros
   ============================================================ */
(function (global) {
  "use strict";

  /* ---- tiny DOM helper ------------------------------------ */
  function el(tag, cls, css) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (css) n.setAttribute("style", css);
    return n;
  }

  /* ---- rounded glass box (6 faces, centred on its origin) -- */
  // w,h,d in px. opts: { r, mat, solid, faces }
  function box(w, h, d, opts) {
    opts = opts || {};
    var r = opts.r != null ? opts.r : Math.min(w, h, d) * 0.28;
    var b = el("div", "b3" + (opts.solid ? " solid" : ""));
    b.style.setProperty("--r", r + "px");
    if (opts.mat) b.style.setProperty("--mat", opts.mat);

    var hw = w / 2, hh = h / 2, hd = d / 2;
    var FACES = {
      front:  { w: w, h: h, t: "translate(-50%,-50%) translateZ(" + hd + "px)" },
      back:   { w: w, h: h, t: "translate(-50%,-50%) rotateY(180deg) translateZ(" + hd + "px)" },
      right:  { w: d, h: h, t: "translate(-50%,-50%) rotateY(90deg) translateZ(" + hw + "px)" },
      left:   { w: d, h: h, t: "translate(-50%,-50%) rotateY(-90deg) translateZ(" + hw + "px)" },
      top:    { w: w, h: d, t: "translate(-50%,-50%) rotateX(90deg) translateZ(" + hh + "px)" },
      bottom: { w: w, h: d, t: "translate(-50%,-50%) rotateX(-90deg) translateZ(" + hh + "px)" }
    };
    var pick = opts.faces || ["front", "back", "right", "left", "top", "bottom"];
    var abbr = { front: "f-front", back: "f-back", right: "f-right", left: "f-left", top: "f-top", bottom: "f-bottom" };
    pick.forEach(function (k) {
      var f = FACES[k];
      var fe = el("div", "face " + abbr[k]);
      fe.style.width = f.w + "px";
      fe.style.height = f.h + "px";
      fe.style.transform = f.t;
      b.appendChild(fe);
    });
    return b;
  }

  /* place a node (box / group) at x,y,z with optional rotation */
  function at(node, x, y, z, rot) {
    var t = "translate3d(" + (x || 0) + "px," + (y || 0) + "px," + (z || 0) + "px)";
    if (rot) t += " " + rot;
    node.style.transform = t;
    return node;
  }

  /* zero-size 3D group whose children share one origin */
  function group(cls) {
    var g = el("div", cls || "");
    g.style.position = "absolute";
    g.style.transformStyle = "preserve-3d";
    g.style.left = g.style.top = "0";
    return g;
  }

  /* ============================================================
     OBJECT BUILDERS — each returns the contents of .kar3d__obj
     Designed within a ~64px cube; one shared perspective/light.
     ============================================================ */
  var BUILD = {};

  /* 1 · FINANCE — three fanned gold ingots, top one catches rim */
  BUILD.finance = function () {
    var g = group();
    var gold = "191,162,62";
    var specs = [
      { w: 52, h: 13, d: 34, y: 16, rz: -7, mat: "150,124,44" },
      { w: 52, h: 13, d: 34, y: 1,  rz: 4,  mat: "176,146,52" },
      { w: 52, h: 13, d: 34, y: -14, rz: -3, mat: gold }
    ];
    specs.forEach(function (s) {
      var bx = box(s.w, s.h, s.d, { r: 5, mat: s.mat, solid: true });
      at(bx, 0, s.y, 0, "rotateZ(" + s.rz + "deg)");
      g.appendChild(bx);
    });
    return g;
  };

  /* 2 · GYM — barbell: slim bar + chunky rounded plates */
  BUILD.gym = function () {
    var g = group();
    var bar = box(72, 7, 7, { r: 3.5, mat: "210,205,196", solid: true });
    g.appendChild(at(bar, 0, 0, 0));
    [-31, 31].forEach(function (x) {
      var plate = box(11, 40, 40, { r: 7, mat: "58,66,82" });
      at(plate, x, 0, 0);
      g.appendChild(plate);
      var collar = box(8, 14, 14, { r: 4, mat: "191,162,62", solid: true });
      at(collar, x < 0 ? x + 9 : x - 9, 0, 0);
      g.appendChild(collar);
    });
    return g;
  };

  /* 3 · SUPPLEMENTS — two-tone capsule pill, tilted, spinning */
  BUILD.supplements = function () {
    var g = group();
    // vertical capsule so the turntable spin never shows it end-on
    var body = box(27, 58, 27, { r: 13.5, mat: "233,226,215" });
    at(body, 0, 0, 0);
    var cap = box(28.4, 30, 28.4, { r: 14.2, mat: "207,122,107" });
    at(cap, 0, -14.4, 0);
    g.appendChild(body);
    g.appendChild(cap);
    at(g, 0, 0, 0, "rotateZ(30deg) rotateX(6deg)");
    return g;
  };

  /* 4 · FITNESS BAND — segmented loop wrapping a pulsing core */
  BUILD.band = function () {
    var g = group();
    var ring = group();
    var N = 14, R = 30;
    for (var i = 0; i < N; i++) {
      var a = (i / N) * 360;
      var seg = box(9, 13, 8, { r: 3.5, mat: "209,204,196" });
      var rad = a * Math.PI / 180;
      var x = Math.cos(rad) * R, y = Math.sin(rad) * R;
      at(seg, x, y, 0, "rotateZ(" + (a + 90) + "deg)");
      ring.appendChild(seg);
    }
    at(ring, 0, 0, 0, "rotateY(58deg)");
    g.appendChild(ring);
    // glowing core node
    var core = el("div", "band-core");
    g.appendChild(core);
    return g;
  };

  /* 5 · WATER — translucent mist-blue droplet, bob + ripple */
  BUILD.water = function () {
    var g = group();
    var drop = el("div", "drop");
    var spec = el("div", "drop-spec");
    drop.appendChild(spec);
    g.appendChild(drop);
    var ripple = el("div", "drop-ripple k-anim");
    g.appendChild(ripple);
    return g;
  };

  /* 6 · CREATOR — clapperboard with hinged striped top bar */
  BUILD.creator = function () {
    var g = group();
    var slab = box(58, 42, 12, { r: 6, mat: "70,80,100" });
    at(slab, 0, 7, 0);
    g.appendChild(slab);
    // hinged top bar pivots from its back edge
    var hinge = group("clap-hinge");
    at(hinge, 0, -14, 0);
    var bar = box(58, 13, 13, { r: 4, mat: "86,96,116" });
    // stripes overlay on the bar's front + top
    var fr = bar.querySelector(".f-front");
    if (fr) fr.classList.add("clap-stripe");
    var tp = bar.querySelector(".f-top");
    if (tp) tp.classList.add("clap-stripe");
    at(bar, 0, 0, 0);
    hinge.appendChild(bar);
    g.appendChild(hinge);
    return g;
  };

  /* 7 · GOALS — three ascending step cubes + gold pennant flag */
  BUILD.goals = function () {
    var g = group();
    var steps = [
      { x: -22, y: 16, s: 22 },
      { x: 0,   y: 6,  s: 22 },
      { x: 22,  y: -6, s: 22 }
    ];
    steps.forEach(function (st) {
      var c = box(st.s, st.s, st.s, { r: 5, mat: "70,78,96" });
      at(c, st.x, st.y, 0);
      g.appendChild(c);
    });
    // flag pole + pennant on the top step
    var pole = box(3, 30, 3, { r: 1.5, mat: "210,205,196", solid: true });
    at(pole, 22, -28, 6);
    g.appendChild(pole);
    var flag = el("div", "pennant k-anim");
    at(flag, 0, 0, 0); // positioned via CSS relative to group origin
    flag.style.transform = "translate3d(28px,-37px,6px)";
    g.appendChild(flag);
    return g;
  };

  /* 8 · PROGRESS — glass card with embossed rising gold sparkline */
  BUILD.progress = function () {
    var g = group();
    var card = box(56, 44, 9, { r: 8, mat: "233,226,215" });
    at(card, 0, 0, 0);
    g.appendChild(card);
    // sparkline drawn just in front of the card's front face
    var svgNS = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", "0 0 56 44");
    svg.setAttribute("class", "spark");
    var path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", "M8 33 L18 28 L27 31 L36 19 L48 11");
    path.setAttribute("class", "spark-line k-anim");
    svg.appendChild(path);
    var dot = document.createElementNS(svgNS, "circle");
    dot.setAttribute("cx", "48"); dot.setAttribute("cy", "11"); dot.setAttribute("r", "3");
    dot.setAttribute("class", "spark-dot k-anim");
    svg.appendChild(dot);
    var holder = el("div", "spark-holder");
    holder.appendChild(svg);
    at(holder, 0, 0, 5.5);
    g.appendChild(holder);
    return g;
  };

  /* 9 · MACROS — three role-coloured rounded bars (split) */
  BUILD.macros = function () {
    var g = group();
    var bars = [
      { x: -17, h: 46, mat: "191,162,62" },  // protein = gold
      { x: 0,   h: 34, mat: "167,192,215" }, // carbs = mist
      { x: 17,  h: 24, mat: "116,180,155" }  // fat = sage
    ];
    bars.forEach(function (bspec) {
      var bx = box(13, bspec.h, 13, { r: 5, mat: bspec.mat });
      at(bx, bspec.x, (46 - bspec.h) / 2, 0);
      g.appendChild(bx);
    });
    return g;
  };

  /* ============================================================
     ASSEMBLY — wrap an object in the shared rig
     ============================================================ */
  // front-facing / flat objects sway gently instead of full-turntable
  // spinning (so their face details never go edge-on)
  var SWAY = { water: 1, progress: 1, creator: 1 };

  function assemble(host, name) {
    var def = BUILD[name];
    var tilt = el("div", "kar3d__tilt");
    var float = el("div", "kar3d__float");
    var spin = el("div", "kar3d__spin" + (SWAY[name] ? " sway" : ""));
    var obj = el("div", "kar3d__obj");
    if (def) obj.appendChild(def());
    spin.appendChild(obj);
    float.appendChild(spin);
    tilt.appendChild(float);
    host.appendChild(tilt);
    wireParallax(host, tilt);
  }

  function build(name) {
    var host = el("span", "kar3d");
    host.setAttribute("data-obj", name);
    host.__kar3d = true;
    assemble(host, name);
    return host;
  }

  /* hydrate an existing .kar3d[data-obj] element in place */
  function hydrate(host) {
    if (host.__kar3d) return;
    host.__kar3d = true;
    assemble(host, host.getAttribute("data-obj"));
  }

  /* hover parallax: tilt the object toward the cursor (spring) */
  function wireParallax(host, tilt) {
    var reduce = global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    var MAX = 16;
    host.addEventListener("pointermove", function (e) {
      var r = host.getBoundingClientRect();
      var px = (e.clientX - r.left) / r.width - 0.5;
      var py = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.setProperty("--ty", (px * MAX) + "deg");
      tilt.style.setProperty("--tx", (-py * MAX) + "deg");
    });
    host.addEventListener("pointerleave", function () {
      tilt.style.setProperty("--ty", "0deg");
      tilt.style.setProperty("--tx", "0deg");
    });
  }

  function mount(root) {
    root = root || document;
    var nodes = root.querySelectorAll(".kar3d[data-obj]");
    Array.prototype.forEach.call(nodes, hydrate);
  }

  global.KAR3D = { build: build, mount: mount, OBJECTS: Object.keys(BUILD) };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { mount(); });
  } else {
    mount();
  }
})(window);

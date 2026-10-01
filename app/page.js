'use client';

import { useEffect } from 'react';
import './landing.css';
import PricingCard from '../components/PricingCard';
import '../components/PricingCard.css';

const SITE_URL = 'https://recrewtai.com';

/**
 * JSON-LD for the landing page.
 *
 * Every claim here is also visible on the page itself — that is a hard
 * requirement of Google's structured-data guidelines. If the pricing on
 * the page changes, change it here too, or the markup becomes a violation
 * rather than an asset.
 */
const LANDING_JSON_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${SITE_URL}/#organization`,
      name: 'Recrewt AI',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/assets/recrewt-logo-tight.png`,
        width: 711,
        height: 172,
      },
      description:
        'Recrewt AI runs adaptive, video-based AI interviews for hiring teams — screening every candidate and returning explainable, evidence-backed scoring.',
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'sales',
        email: 'hello@recrewtai.com',
        url: 'https://calendly.com/mike-recrewtai',
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${SITE_URL}/#website`,
      url: SITE_URL,
      name: 'Recrewt AI',
      publisher: { '@id': `${SITE_URL}/#organization` },
      inLanguage: 'en',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${SITE_URL}/#software`,
      name: 'Recrewt AI',
      url: SITE_URL,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Recruiting and Applicant Screening Software',
      operatingSystem: 'Web browser',
      publisher: { '@id': `${SITE_URL}/#organization` },
      description:
        'AI interview software that automatically screens every candidate. Recrewt AI generates role-specific questions, conducts adaptive video interviews with contextual follow-ups, and returns transparent scoring so hiring teams review evidence instead of resumes.',
      featureList: [
        'Automated AI video interviews',
        'Adaptive, context-aware follow-up questions',
        'Resume-based question generation',
        'Automatic transcription and scoring',
        'Explainable per-answer AI analysis',
        'Candidate shortlisting recommendations',
      ],
      offers: [
        {
          '@type': 'Offer',
          name: 'Growth',
          price: '420',
          priceCurrency: 'USD',
          description:
            '200 candidates per month, 10 active hiring roles, automated video screening.',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}/#pricing`,
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '420',
            priceCurrency: 'USD',
            billingIncrement: 1,
            unitCode: 'MON',
          },
        },
        {
          '@type': 'Offer',
          name: 'Scale',
          price: '620',
          priceCurrency: 'USD',
          description:
            '500 candidates per month, unlimited hiring roles, priority support.',
          availability: 'https://schema.org/InStock',
          url: `${SITE_URL}/#pricing`,
          priceSpecification: {
            '@type': 'UnitPriceSpecification',
            price: '620',
            priceCurrency: 'USD',
            billingIncrement: 1,
            unitCode: 'MON',
          },
        },
      ],
    },
  ],
};

export default function LandingPage() {
  // Site nav: fixed to the top. On desktop it rises from the bottom of the
  // screen during the blank white moment at the very end of the hero
  // (after "Welcome to the team", before the interlude text), so it never
  // crosses any content. On phones (static hero) it drops in from the top.
  // Separate from the hero/interlude scripts below, which are unchanged.
  useEffect(() => {
    var hero = document.getElementById('hero');
    var nav = document.getElementById('siteNav');
    var stage = document.getElementById('stage');
    if (!hero || !nav) return;
    var raf = null;
    function check() {
      raf = null;
      var r = hero.getBoundingClientRect();
      var dist = hero.offsetHeight - window.innerHeight;
      var show;
      if (dist > 0) {
        // rise only once the desk photo has actually faded to white
        // (the hero engine eases its fade, so read the stage itself)
        var stageOpacity = stage ? parseFloat(stage.style.opacity || '1') : 0;
        show = (-r.top / dist) >= 0.96 && stageOpacity < 0.2;
      } else {
        show = r.bottom <= Math.min(window.innerHeight * 0.5, r.height - 120);
      }
      nav.classList.toggle('is-visible', show);
    }
    function onScroll() { if (raf === null) raf = requestAnimationFrame(check); }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    // the stage keeps fading for a moment after scrolling stops, so also
    // re-check whenever the hero engine updates its opacity
    var mo = stage && 'MutationObserver' in window ? new MutationObserver(onScroll) : null;
    if (mo) mo.observe(stage, { attributes: true, attributeFilter: ['style'] });
    check();
    return function () {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (mo) mo.disconnect();
    };
  }, []);

  // Hero story boxes: placed on the empty wall areas of the desk photo
  // (left of the monitor, right of the monitor) so they never cover the
  // paperwork. Positions follow the photo as it scales. Only sets
  // left/top/max-width; the hero script still owns the fade timing.
  useEffect(() => {
    var pin = document.querySelector('.rc-landing .hero-pin');
    var fig = document.getElementById('figure');
    var notes = [document.getElementById('hn1'), document.getElementById('hn2'), document.getElementById('hn3')];
    if (!pin || !fig || notes.some(function (n) { return !n; })) return;
    var GUTTER = 24, MIN_RIGHT = 190;
    function setBox(el, x, y, w) {
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.right = 'auto'; el.style.bottom = 'auto';
      el.style.maxWidth = w + 'px';
    }
    function place() {
      if (window.innerWidth <= 760) { notes.forEach(function (n) { n.removeAttribute('style'); }); return; }
      var f = fig.getBoundingClientRect(), p = pin.getBoundingClientRect();
      if (!f.width) return;
      var X = function (fx) { return f.left - p.left + fx * f.width; };
      var Y = function (fy) { return f.top - p.top + fy * f.height; };
      // Reading path shaped like ">": top left, then lower on the right,
      // then lowest on the left. No symmetry on purpose.
      var vw = p.width, vh = p.height;
      var edge = Math.min(Math.max(56, vw * 0.06), 112);   // same left edge as the logo
      var keep = function (el) { return { o: el.style.opacity, t: el.style.transform }; };
      notes.forEach(function (n) { var k = keep(n); n.removeAttribute('style'); n.style.opacity = k.o; n.style.transform = k.t; });
      // 1) left wall, high up, between the window and the monitor
      var x1 = Math.max(X(0.215), GUTTER), y1 = Math.max(Y(0.13), 104);
      var w1 = Math.max(220, Math.min(X(0.448) - x1, 380));
      setBox(notes[0], x1, y1, w1);
      // 2) right wall, lower, beside the monitor (falls back to lower on the left wall when that gap is too thin)
      var x2 = X(0.828), w2 = Math.min(vw - GUTTER - x2, 320), y2 = Math.max(Y(0.34), y1 + 120);
      if (w2 >= MIN_RIGHT) setBox(notes[1], x2, y2, w2);
      else setBox(notes[1], Math.max(X(0.27), GUTTER), Math.max(Y(0.29), y1 + 110), Math.max(220, Math.min(X(0.448) - X(0.27), 320)));
      // 3) lowest, back on the left, above the folder by the window sill
      var y3 = Math.min(Math.max(Y(0.47), y2 + 110), vh - 150);
      setBox(notes[2], edge, y3, Math.max(220, Math.min(X(0.30) - edge, 360)));
    }
    var ro = 'ResizeObserver' in window ? new ResizeObserver(place) : null;
    if (ro) { ro.observe(fig); ro.observe(pin); }
    window.addEventListener('resize', place);
    requestAnimationFrame(place);
    return function () { if (ro) ro.disconnect(); window.removeEventListener('resize', place); };
  }, []);

  useEffect(() => {
    // Inline scripts from the original standalone landing HTML.
    // Each expects the DOM (hero stage, panel-interview, spine dots, etc.)
    // to be present, so useEffect after mount is the right place.

    // All original inline <script> blocks from the standalone HTML,
    // run once on client mount.  Each was written to be idempotent
    // and expects the DOM to already exist, so useEffect is the
    // correct hook.

    // --- inline script 1 ---
    (function () {
      var sec = document.getElementById("interlude"); if (!sec) return;
      var logo = sec.querySelector(".il-logo"), belief = sec.querySelector(".il-belief");
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      function c01(t){ return t<0?0:t>1?1:t; }
      function ss(a,b,p){ var t=c01((p-a)/(b-a)); return t*t*(3-2*t); }
      var raf = null;
      function frame(){
        raf = null;
        var r = sec.getBoundingClientRect(), vh = window.innerHeight;
        /* 0 as the white canvas begins entering -> 1 as it fully exits */
        var p = c01((vh - r.top) / (r.height + vh));
        var out = ss(0.65, 0.82, p);                 /* gentle recede, then Section 2 enters */
        logo.style.opacity   = (ss(0.03, 0.10, p) * (1 - out)).toFixed(3);
        var bi = ss(0.07, 0.15, p);                  /* tagline just after the logo */
        belief.style.opacity = (bi * (1 - out)).toFixed(3);
        belief.style.transform = "translateY(" + (8 - 8 * bi).toFixed(1) + "px)";
      }
      function onScroll(){ if (raf === null) raf = requestAnimationFrame(frame); }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      frame();
    })();

    // --- inline script 2 ---
    /* ============================================================
       SECTION 2 — entry motion, one-shot visual moments, spine
       ============================================================ */
    (function () {
      "use strict";
    
      var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var reveals = Array.prototype.slice.call(document.querySelectorAll(".how .reveal, .fit .reveal, .pricing .reveal, .cta .reveal, .ft.reveal"));
    
      var panelInterview = document.getElementById("panelInterview");
      var ivGrid = panelInterview.querySelector(".iv-grid");
      var ivPhrase = document.getElementById("ivPhrase");
      var ivFollowup = document.getElementById("ivFollowup");
      var ivConnect = document.getElementById("ivConnect");
      var ivPath = document.getElementById("ivPath");
    
      function layoutConnector() {
        var g = ivGrid.getBoundingClientRect();
        var a = ivPhrase.getBoundingClientRect();
        /* ivFollowup is the .iv-turn row; connector should land on the bubble itself */
        var bubble = ivFollowup.querySelector(".iv-bubble") || ivFollowup;
        var b = bubble.getBoundingClientRect();
        /* subtle S-curve: tail of highlighted phrase -> top of follow-up bubble */
        var x1 = a.right - g.left - Math.min(12, a.width * 0.25);
        var y1 = a.bottom - g.top + 4;
        var x2 = b.left - g.left + Math.min(96, b.width * 0.32);
        var y2 = b.top - g.top - 4;
        var dy = Math.max(20, (y2 - y1) * 0.55);
        var d = "M " + x1 + " " + y1 +
                " C " + x1 + " " + (y1 + dy) + ", " +
                        x2 + " " + (y2 - dy * 0.6) + ", " + x2 + " " + y2;
        ivConnect.setAttribute("width", g.width);
        ivConnect.setAttribute("height", g.height);
        ivConnect.setAttribute("viewBox", "0 0 " + g.width + " " + g.height);
        ivPath.setAttribute("d", d);
        var len = ivPath.getTotalLength();
        ivPath.style.strokeDasharray = len;
        if (!panelInterview.classList.contains("play")) ivPath.style.strokeDashoffset = len;
        else ivPath.style.strokeDashoffset = 0;
      }
    
      function playConnector() {
        if (panelInterview.classList.contains("play")) return;
        layoutConnector();
        void ivPath.getBoundingClientRect();
        panelInterview.classList.add("play");
      }
    
      window.addEventListener("resize", function () { layoutConnector(); });
    
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (!en.isIntersecting) return;
            en.target.classList.add("in");
            if (en.target.querySelector && en.target.querySelector(".panel-interview")) playConnector();
            io.unobserve(en.target);
          });
        }, { threshold: 0.3 });
        // Defer observe() calls to the next animation frame so the
        // observer's initial synchronous callback batch — which
        // adds the `.in` class to elements already in view — cannot
        // interleave with React 19 concurrent hydration and produce
        // "server rendered HTML didn't match client" warnings.
        // useEffect alone runs post-commit, but IntersectionObserver
        // callbacks are microtasks that can still land inside a
        // hydration pass on deeply-nested content.
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            reveals.forEach(function (el) { io.observe(el); });
          });
        });
      } else {
        requestAnimationFrame(function () {
          reveals.forEach(function (el) { el.classList.add("in"); });
          playConnector();
        });
      }
    
      var howBody = document.getElementById("howBody");
      var spineFill = document.getElementById("spineFill");
      var dots = [
        document.getElementById("spineDot1"),
        document.getElementById("spineDot2"),
        document.getElementById("spineDot3")
      ];
      var chapters = [
        document.getElementById("chapter1"),
        document.getElementById("chapter2"),
        document.getElementById("chapter3")
      ];
    
      function layoutSpine() {
        var i, ch;
        for (i = 0; i < 3; i++) {
          ch = chapters[i];
          if (!ch) continue;
          dots[i].style.top = (ch.offsetTop + ch.offsetHeight / 2 - 6) + "px";
        }
      }
    
      function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
    
      function updateSpine() {
        var r = howBody.getBoundingClientRect();
        var mid = window.innerHeight * 0.6;
        spineFill.style.height = (clamp01((mid - r.top) / r.height) * 100).toFixed(2) + "%";
      }
    
      window.addEventListener("scroll", updateSpine, { passive: true });
      window.addEventListener("resize", function () { layoutSpine(); updateSpine(); });
      layoutSpine();
      updateSpine();
      layoutConnector();
    })();

    // --- inline script 3 ---
    /* ============================================================
       SECTION 1 — HERO engine (rebuilt from zero)
       One normalized progress value p (0..1) drives EVERY visual
       state as a pure function. Single rAF loop, smoothing 0.18.
       ============================================================ */
    (function () {
      "use strict";
    
      function clamp01(t) { return t < 0 ? 0 : t > 1 ? 1 : t; }
      function seg(p, a, b) { return clamp01((p - a) / (b - a)); }
      function smoothstep(a, b, p) { var t = seg(p, a, b); return t * t * (3 - 2 * t); }
    
      var IMG_W = 1408, IMG_H = 768;
      var stage  = document.getElementById("stage");
      var figure = document.getElementById("figure");
      var screenEl = document.getElementById("monitor");
    
      function layoutStage() {
        var vw = stage.clientWidth, vh = stage.clientHeight;
        if (!vw || !vh) return;
        var cs = getComputedStyle(stage);
        var posX = parseFloat(cs.getPropertyValue("--pos-x")) || 0.5;
        var posY = parseFloat(cs.getPropertyValue("--pos-y")) || 0.5;
        var s = Math.max(vw / IMG_W, vh / IMG_H);
        var dw = IMG_W * s, dh = IMG_H * s;
        figure.style.width = dw + "px"; figure.style.height = dh + "px";
        figure.style.left = (vw - dw) * posX + "px";
        figure.style.top  = (vh - dh) * posY + "px";
        applyProjection();
        var pfEl = document.getElementById("payoff");
        if (pfEl) {
          pfEl.style.left = ((vw - dw) * posX + 0.6328 * dw) + "px";
          pfEl.style.top  = ((vh - dh) * posY + 0.352 * dh) + "px";
        }
      }
    
      var STAGE_W = 1280, STAGE_H = 760;
      var CORNERS = [[0.4652,0.0964],[0.8004,0.1328],[0.7890,0.5130],[0.4666,0.4336]];
      function adj(m){return [m[4]*m[8]-m[5]*m[7],m[2]*m[7]-m[1]*m[8],m[1]*m[5]-m[2]*m[4],m[5]*m[6]-m[3]*m[8],m[0]*m[8]-m[2]*m[6],m[2]*m[3]-m[0]*m[5],m[3]*m[7]-m[4]*m[6],m[1]*m[6]-m[0]*m[7],m[0]*m[4]-m[1]*m[3]];}
      function multmm(a,b){var c=[],i,j,k,s;for(i=0;i<3;i++)for(j=0;j<3;j++){s=0;for(k=0;k<3;k++)s+=a[3*i+k]*b[3*k+j];c[3*i+j]=s;}return c;}
      function basisToPoints(p1,p2,p3,p4){var m=[p1[0],p2[0],p3[0],p1[1],p2[1],p3[1],1,1,1];var a=adj(m);var v=[a[0]*p4[0]+a[1]*p4[1]+a[2],a[3]*p4[0]+a[4]*p4[1]+a[5],a[6]*p4[0]+a[7]*p4[1]+a[8]];return multmm(m,[v[0],0,0,0,v[1],0,0,0,v[2]]);}
      function projectQuad(w,h,q){var s=basisToPoints([0,0],[w,0],[w,h],[0,h]);var d=basisToPoints(q[0],q[1],q[2],q[3]);var t=multmm(d,adj(s)),i;for(i=0;i<9;i++)t[i]/=t[8];return [t[0],t[3],0,t[6],t[1],t[4],0,t[7],0,0,1,0,t[2],t[5],0,t[8]];}
      function applyProjection(){var w=figure.offsetWidth,h=figure.offsetHeight;if(!w)return;var q=CORNERS.map(function(c){return [c[0]*w,c[1]*h];});screenEl.style.transform="matrix3d("+projectQuad(STAGE_W,STAGE_H,q).join(",")+")";}
    
      if ("ResizeObserver" in window) new ResizeObserver(layoutStage).observe(stage);
      else window.addEventListener("resize", layoutStage);
      layoutStage();
    
      var $ = function (id) { return document.getElementById(id); };
      var f0 = $("f0"), f1 = $("f1"), f2 = $("f2"), f3 = $("f3");
      var copy = $("heroCopy"), sub = $("heroSub"), readfield = $("readfield"), hd = $("heroHd");
      var pipe = $("pipeUI"), offerFlag = $("offerFlag"), poOffer = $("poOffer"), poWelcome = $("poWelcome");
      var notes = [$("hn1"), $("hn2"), $("hn3")];
      var hdLine = $("hdLine"), pf = $("payoff");
      [f0, f1, f2, f3].forEach(function (img) { if (img.decode) img.decode().catch(function(){}); });
    
      var CUT1 = [0.340, 0.380], CUT2 = [0.500, 0.540], CUT3 = [0.660, 0.700];
      var NOTE_T = [
        [0.390, 0.430, 0.480, 0.520],
        [0.540, 0.580, 0.640, 0.680],
        [0.710, 0.750, 0.860, 0.900]
      ];
    
      function update(p) {
        var reveal = smoothstep(0.10, 0.24, p);
        var exit   = smoothstep(0.97, 1.00, p);
        stage.style.opacity = (reveal * (1 - exit)).toFixed(3);
    
        f1.style.opacity = smoothstep(CUT1[0], CUT1[1], p).toFixed(3);
        f2.style.opacity = smoothstep(CUT2[0], CUT2[1], p).toFixed(3);
        f3.style.opacity = smoothstep(CUT3[0], CUT3[1], p).toFixed(3);
    
        var cOut = smoothstep(0.24, 0.30, p);
        copy.style.opacity = (1 - cOut).toFixed(3);
        copy.style.transform = "translateY(" + (-10 * cOut).toFixed(1) + "px)";
        copy.style.pointerEvents = cOut > 0.98 ? "none" : "auto";
        sub.style.opacity = (1 - smoothstep(0.20, 0.28, p)).toFixed(3);
    
        readfield.style.opacity = ((1 - cOut) * smoothstep(0.06, 0.16, p)).toFixed(3);
    
        hd.style.opacity = (1 - smoothstep(0.94, 0.99, p)).toFixed(3);
        hdLine.style.opacity = (1 - 0.92 * smoothstep(0.24, 0.36, p)).toFixed(3);
    
        for (var i = 0; i < 3; i++) {
          var t = NOTE_T[i];
          var vis = smoothstep(t[0], t[1], p) * (1 - smoothstep(t[2], t[3], p));
          notes[i].style.opacity = vis.toFixed(3);
          notes[i].style.transform = "translateY(" + (14 - 14 * smoothstep(t[0], t[1], p)).toFixed(1) + "px)";
        }
    
        var pIn = smoothstep(0.72, 0.84, p);
        pipe.style.opacity = pIn.toFixed(3);
        pipe.style.transform = "translateY(" + (8 - 8 * pIn).toFixed(2) + "px)";
    
        offerFlag.style.opacity = smoothstep(0.84, 0.88, p).toFixed(3);
        var oIn = smoothstep(0.88, 0.915, p);
        poOffer.style.opacity = (oIn * (1 - exit)).toFixed(3);
        poOffer.style.transform = "translateY(" + (6 - 6 * oIn).toFixed(1) + "px)";
        var wIn = smoothstep(0.935, 0.97, p);
        poWelcome.style.opacity = (wIn * (1 - exit)).toFixed(3);
        poWelcome.style.transform = "translateY(" + (8 - 8 * wIn).toFixed(1) + "px)";
      }
    
      var track = document.getElementById("hero");
      var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var target = 0, current = -1, raf = null;
    
      function readProgress() {
        var dist = track.offsetHeight - window.innerHeight;
        if (dist <= 0) return 0;
        return clamp01(-track.getBoundingClientRect().top / dist);
      }
    
      if (reduced) {
        stage.style.opacity = "1";
        figure.style.transform = "scale(1)";
        f1.style.opacity = f2.style.opacity = f3.style.opacity = "0";
        copy.style.opacity = "1"; copy.style.pointerEvents = "auto";
        sub.style.opacity = "1"; hd.style.opacity = "1";
        readfield.style.opacity = "0.5";
        notes.forEach(function (n) { n.style.opacity = "0"; });
        pipe.style.opacity = "0"; poOffer.style.opacity = "0"; poWelcome.style.opacity = "0";
        return;
      }
    
      function tick() {
        raf = null;
        current += (target - current) * 0.18;
        if (Math.abs(target - current) < 0.0005) current = target;
        update(current);
        if (current !== target) raf = requestAnimationFrame(tick);
      }
      function onScroll() { target = readProgress(); if (raf === null) raf = requestAnimationFrame(tick); }
    
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", function () { layoutStage(); onScroll(); });
    
      current = target = readProgress();
      update(current);
    })();

    }, []);

  return (
    <div className="rc-landing">
{/* ============================================================
     STRUCTURED DATA — tells Google (and AI answer engines) exactly
     what Recrewt is, what it costs, and who publishes it.
     ============================================================ */}
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(LANDING_JSON_LD) }}
/>

{/* ============================================================
     SECTION 1 — HERO (rebuilt)
     ============================================================ */}
<div className="hero" id="hero">
  <section className="hero-pin" aria-labelledby="hc-headline">

    {/* desk stage: revealed from white; never visible at progress 0 */}
    <div className="stage" id="stage" aria-hidden="true">
      <figure className="figure" id="figure">
        <div className="frames">
          {/* Each frame ships AVIF -> WebP -> JPEG. The browser picks the
              first format it supports, so modern browsers download roughly
              a third of the old JPEG weight. `.frames picture` is
              display:contents in landing.css, so the <img> keeps its exact
              previous layout and every existing CSS/JS hook still applies. */}
          {/* FRAME 0 · clean empty desk (approved, permanent base once revealed) */}
          <picture>
            <source srcSet="/assets/hero-approved/frame0-2816.avif" type="image/avif" />
            <source srcSet="/assets/hero-approved/frame0-2816.webp" type="image/webp" />
            <img id="f0" src="/assets/hero-approved/frame0-2816.jpg"
              width="2816" height="1536"
              alt="A clean recruiter's desk beside a window with a monitor running Recrewt AI; as the page scrolls, candidate paperwork accumulates until Recrewt organizes it into a clear pipeline."
              fetchPriority="high" decoding="async" />
          </picture>
          {/* FRAME 1 · first candidate material */}
          <picture>
            <source srcSet="/assets/hero-approved/desk-frame-01.avif" type="image/avif" />
            <source srcSet="/assets/hero-approved/desk-frame-01.webp" type="image/webp" />
            <img className="over" id="f1" src="/assets/hero-approved/desk-frame-01.jpg"
              width="2816" height="1536" alt="" decoding="async" />
          </picture>
          {/* FRAME 2 · screening / evaluation work accumulates */}
          <picture>
            <source srcSet="/assets/hero-approved/desk-frame-03.avif" type="image/avif" />
            <source srcSet="/assets/hero-approved/desk-frame-03.webp" type="image/webp" />
            <img className="over" id="f2" src="/assets/hero-approved/desk-frame-03.jpg"
              width="2816" height="1536" alt="" decoding="async" />
          </picture>
          {/* FRAME 3 · peak workload / organized dashboard */}
          <picture>
            <source srcSet="/assets/hero-approved/desk-frame-04.avif" type="image/avif" />
            <source srcSet="/assets/hero-approved/desk-frame-04.webp" type="image/webp" />
            <img className="over" id="f3" src="/assets/hero-approved/desk-frame-04.jpg"
              width="2816" height="1536" alt="" decoding="async" />
          </picture>
        </div>

        {/* monitor overlay: organized pipeline resolves on Frame 3 */}
        <div className="monitor" id="monitor" aria-hidden="true">
          <div className="screen-stage">
            <div className="pipe" id="pipeUI">
              <div className="pipe-top">
                <span className="mini-brand">Recrewt <span className="mini-chip">AI</span></span>
                <span className="pipe-title">Today’s Overview</span>
              </div>
              <div className="pipe-cols">
                <div className="pipe-col">
                  <div className="pc-head"><span className="pc-name">Applications</span><span className="pc-count">12</span></div>
                  <div className="pc-card"><i></i><u></u></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                  <div className="pc-card"><i></i><u></u></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                  <div className="pc-more">+8 more</div>
                </div>
                <div className="pipe-col">
                  <div className="pc-head"><span className="pc-name">AI Screening</span><span className="pc-count">4</span></div>
                  <div className="pc-card"><i></i><u></u></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                  <div className="pc-card"><i></i><u></u></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                </div>
                <div className="pipe-col">
                  <div className="pc-head"><span className="pc-name">Interview</span><span className="pc-count">3</span></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                  <div className="pc-card"><i></i><u></u></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                </div>
                <div className="pipe-col hot">
                  <div className="pc-head"><span className="pc-name">Shortlisted</span><span className="pc-count">2</span></div>
                  <div className="pc-card"><i></i><u></u></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                </div>
                <div className="pipe-col">
                  <div className="pc-head"><span className="pc-name">Offer</span><span className="pc-count">1</span></div>
                  <div className="pc-card offer-card"><i></i><u className="short"></u>
                    <span className="offer-flag" id="offerFlag">✓ Accepted</span>
                  </div>
                </div>
                <div className="pipe-col">
                  <div className="pc-head"><span className="pc-name">Hired</span><span className="pc-count">10</span></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                  <div className="pc-card"><i></i><u></u></div>
                  <div className="pc-card"><i></i><u className="short"></u></div>
                  <div className="pc-card"><i></i><u></u></div>
                  <div className="pc-more">+6 more</div>
                </div>
              </div>
            </div>
            <div className="screen-glass"></div>
          </div>
        </div>
      </figure>
    </div>

    {/* local readability field (left), only while copy is visible */}
    <div className="readfield" id="readfield" aria-hidden="true"></div>

    {/* header */}
    <header className="hero-hd" id="heroHd">
      <a className="logo" href="#hero" aria-label="Recrewt AI — back to top">
        <img src="/assets/recrewt-logo-tight.png" alt="Recrewt AI" width="711" height="172" fetchPriority="high" />
      </a>
      <div className="hd-actions">
        <p className="hd-line" id="hdLine">Adaptive AI interviews for modern hiring teams.</p>
        <nav className="hd-nav" aria-label="Main">
          <a href="#how-it-works">How it works</a>
          <a href="#pricing">Pricing</a>
          <a href="#trust">Trust</a>
        </nav>
        <a className="hd-login" href="/login">Log in</a>
        <a className="hd-demo" href="https://calendly.com/mike-recrewtai" target="_blank" rel="noopener noreferrer">Book a demo</a>
      </div>
    </header>

    {/* hero copy */}
    <div className="hero-copy" id="heroCopy">
      <p className="hc-eyebrow">AI interviewer for hiring teams</p>
      <h1 className="hc-headline" id="hc-headline">
        Every candidate <em>screened.</em>
        <span className="l2">Before your team spends a minute.</span>
      </h1>
      <p className="hc-sub" id="heroSub">
        Recrewt AI interviews each applicant on video, asks follow-up
        questions about what they actually said, and gives your team scored
        answers with the reasons behind each score.
      </p>
      <div className="hc-actions">
        <a className="btn btn-primary" href="#pricing">
          Get started <span className="arrow" aria-hidden="true">→</span>
        </a>
        <a className="btn btn-secondary" href="https://calendly.com/mike-recrewtai" target="_blank" rel="noopener noreferrer">Book a demo</a>
      </div>
    </div>

    {/* story notes — asymmetric, in the desk's negative space */}
    <div className="note" id="hn1" aria-hidden="true"><p className="ht">200 applications. One open role.</p></div>
    <div className="note" id="hn2" aria-hidden="true"><p className="ht">The pile keeps growing.</p></div>
    <div className="note" id="hn3" aria-hidden="true"><p className="ht">Recrewt interviews all of them.</p></div>

    {/* payoff — calm, human, in the final frame's negative space */}
    <div className="payoff" id="payoff" aria-hidden="true">
      <span className="po-offer" id="poOffer"><span className="po-check">✓</span> Offer Accepted</span>
      <div className="po-welcome" id="poWelcome">Welcome to the team.</div>
    </div>

  </section>
</div>

{/* ============================================================
     SITE NAV — fixed to the top, fades in once the hero is done
     (see the first useEffect). The hero itself is untouched.
     ============================================================ */}
<header className="site-nav" id="siteNav">
  <div className="sn-inner">
    <a className="sn-logo" href="#hero" aria-label="Recrewt AI, back to top">
      <img src="/assets/recrewt-logo-tight.png" alt="Recrewt AI" width="711" height="172" loading="lazy" decoding="async" />
    </a>
    <nav className="sn-links" aria-label="Sections">
      <a href="#how-it-works">How it works</a>
      <a href="#pricing">Pricing</a>
      <a href="#trust">Trust</a>
    </nav>
    <div className="sn-actions">
      <a className="sn-login" href="/login">Log in</a>
      <a className="sn-btn sn-btn-sec" href="https://calendly.com/mike-recrewtai" target="_blank" rel="noopener noreferrer">Book a demo</a>
      <a className="sn-btn sn-btn-pri" href="#pricing">Get started</a>
    </div>
  </div>
</header>

{/* ============================================================
     BRAND INTERLUDE — the white canvas becomes a brand belief card
     ============================================================ */}
<section className="interlude" id="interlude" aria-label="Recrewt AI">
  <div className="il-pin">
    <div className="il-inner">
      <img className="il-logo" src="/assets/recrewt-logo-tight.png" alt="Recrewt AI" width="711" height="172" loading="lazy" decoding="async" />
      <h2 className="il-belief">Most applicants never get <em>a conversation.</em><br />Now all of them can.</h2>
    </div>
  </div>
</section>
{/* ============================================================
     SECTION 2 — HOW RECREWT AI WORKS
     ============================================================ */}
<section className="how" id="how-it-works" aria-labelledby="how-heading">
  <div className="container how-head reveal">
    <p className="eyebrow-2">How it works</p>
    <h2 id="how-heading">Three steps.<br /><em>One great hire.</em></h2>
    <p className="how-sub">Spend your time choosing candidates, not screening them.</p>
  </div>

  <div className="container how-body" id="howBody">
    <div className="spine" aria-hidden="true">
      <span className="spine-fill" id="spineFill"></span>
      <span className="spine-dot" id="spineDot1"></span>
      <span className="spine-dot" id="spineDot2"></span>
      <span className="spine-dot" id="spineDot3"></span>
    </div>

    {/* 01 · editorial two-column (reference match) */}
    <article className="step1" id="chapter1">
      <div className="s1-left reveal">
        <span className="s1-num">Step 1 of 3</span>
        <h3 className="s1-title">Create the role.</h3>
        <p className="s1-copy">
          Describe the role and the level you need. Recrewt drafts the
          interview questions. Add a candidate's resume and they get specific
          to that person. Review, edit and choose exactly what gets asked.
        </p>
        <ul className="s1-features">
          <li className="s1-feat"><span className="s1-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M7 9l5-5 5 5"/><path d="M4 15v4a1 1 0 001 1h14a1 1 0 001-1v-4"/></svg></span><b>Resume upload optional</b></li>
          <li className="s1-feat"><span className="s1-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 00-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg></span><b>Questions fully editable</b></li>
          <li className="s1-feat"><span className="s1-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M11 6h9M11 12h9M11 18h9"/><path d="M3.5 6l1.5 1.5L7.5 5M3.5 12l1.5 1.5 2.5-2.5M3.5 18l1.5 1.5 2.5-2.5"/></svg></span><b>You choose what gets asked</b></li>
        </ul>
      </div>

      <div className="s1-right reveal">
        <div className="cr-app" role="img" aria-label="Recrewt AI - Create New Role screen">
          <aside className="cr-side">
            <div className="cr-brand">Recrewt <span>AI</span></div>
            <nav className="cr-nav">
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span>Dashboard</span></a>
              <a className="on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2 2 0 0110 3.5h4a2 2 0 012 2V7"/></svg><span>Roles</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0111 0"/><path d="M16 5.5a3 3 0 010 5.7M20 20a5 5 0 00-4-4.9"/></svg><span>Candidates</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg><span>Interviews</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3"/></svg><span>AI Agents</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 20h16"/><rect x="5" y="12" width="3.4" height="6" rx="1"/><rect x="10.3" y="7" width="3.4" height="11" rx="1"/><rect x="15.6" y="9.5" width="3.4" height="8.5" rx="1"/></svg><span>Reports</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/></svg><span>Settings</span></a>
            </nav>
            <div className="cr-user"><span className="cr-av">AM</span><span><b>Arjun Mehta</b><em>Hiring Manager</em></span></div>
          </aside>
          <div className="cr-main">
            <div className="cr-head">
              <div><h4>Create New Role</h4><p>Add the details below to create a new role.</p></div>
              <span className="cr-btn">Create Role</span>
            </div>
            <div className="cr-form">
              <div className="cr-field"><label>Role Title</label><div className="cr-input cr-filled">Senior Product Designer</div></div>
              <div className="cr-grid">
                <div className="cr-field"><label>Job Description</label><div className="cr-textarea cr-filled">Own the end-to-end design of our onboarding and activation flows. Work with product and engineering from research to ship.</div></div>
                <div className="cr-col">
                  <div className="cr-field"><label>Job Category</label><div className="cr-select cr-filled">Design <em>▾</em></div></div>
                  <div className="cr-field"><label>Specialization <em>(Optional)</em></label><div className="cr-select cr-filled">Product design <em>▾</em></div></div>
                </div>
              </div>
              <div className="cr-two">
                <div className="cr-field"><label>Experience Level</label><div className="cr-select cr-filled">5 to 8 years <em>▾</em></div></div>
                <div className="cr-field"><label>Employment Type</label><div className="cr-select cr-filled">Full-time <em>▾</em></div></div>
              </div>
            </div>
            <div className="cr-roles">
              <div className="cr-roles-head"><h5>Your Existing Roles</h5><span className="cr-viewall">View All Roles</span></div>
              <table className="cr-table">
                <thead><tr><th>Role Title</th><th>Category</th><th>Experience</th><th>Created On</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>Frontend Developer</td><td>Engineering</td><td>3 – 5 years</td><td>24 Sep 2026</td><td><span className="cr-badge">Active</span></td></tr>
                  <tr><td>Customer Success Lead</td><td>Operations</td><td>4 – 6 years</td><td>18 Sep 2026</td><td><span className="cr-badge">Active</span></td></tr>
                  <tr><td>Marketing Associate</td><td>Marketing</td><td>1 – 3 years</td><td>11 Sep 2026</td><td><span className="cr-badge">Active</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </article>

    {/* 02 · header row (intro + feature cards) + full-width interview app card */}
    <article className="step2" id="chapter2">
      <div className="s2-header reveal">
        <div className="s2-intro">
          <span className="s1-num">Step 2 of 3</span>
          <h3 className="s1-title">AI runs the interview.</h3>
          <p>Recrewt’s AI conducts natural, adaptive interviews that adjust in real time. Every answer unlocks deeper insights and better follow-ups.</p>
        </div>
        <div className="s2-features">
          <div className="s2-feat">
            <span className="s2-ic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.6 4.8 4.8 1.6-4.8 1.6L12 15.3l-1.6-4.8-4.8-1.6 4.8-1.6L12 2.5zM18.5 14l.9 2.7 2.6.8-2.6.8-.9 2.7-.9-2.7-2.6-.8 2.6-.8.9-2.7zM5.5 15.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9z"/></svg></span>
            <b>Adaptive AI interviews</b>
            <p>The AI listens and adapts questions based on each candidate’s answers.</p>
          </div>
          <div className="s2-feat">
            <span className="s2-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2.4"/><path d="M16 10l5-3v10l-5-3z"/></svg></span>
            <b>Face to face on video</b>
            <p>Closer to a real conversation than a form, and easier to judge.</p>
          </div>
          <div className="s2-feat">
            <span className="s2-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z"/><path d="M10 9.3a2 2 0 112.6 1.9c-.4.2-.6.5-.6.9M12 13.8h.01"/></svg></span>
            <b>Real follow-ups</b>
            <p>Digs into what the candidate said and moves on when there&rsquo;s nothing more to get.</p>
          </div>
        </div>
      </div>

      <div className="reveal">
        <div className="cr-app cr-app-iv" role="img" aria-label="Recrewt AI - Live candidate interview screen">
          <aside className="cr-side">
            <div className="cr-brand">Recrewt <span>AI</span></div>
            <nav className="cr-nav">
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg><span>Dashboard</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5.5A2 2 0 0110 3.5h4a2 2 0 012 2V7"/></svg><span>Roles</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3"/><path d="M3.5 20a5.5 5.5 0 0111 0"/><path d="M16 5.5a3 3 0 010 5.7M20 20a5 5 0 00-4-4.9"/></svg><span>Candidates</span></a>
              <a className="on"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/></svg><span>Interviews</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 2v3M14 2v3M10 19v3M14 19v3M2 10h3M2 14h3M19 10h3M19 14h3"/></svg><span>AI Agents</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M4 20h16"/><rect x="5" y="12" width="3.4" height="6" rx="1"/><rect x="10.3" y="7" width="3.4" height="11" rx="1"/><rect x="15.6" y="9.5" width="3.4" height="8.5" rx="1"/></svg><span>Reports</span></a>
              <a><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/></svg><span>Settings</span></a>
            </nav>
            <div className="cr-user"><span className="cr-av">AM</span><span><b>Arjun Mehta</b><em>Hiring Manager</em></span></div>
          </aside>
          <div className="cr-main">
            <div className="iv-head">
              <div className="iv-identity">
                <span className="iv-avatar" aria-hidden="true"><img src="/assets/candidates/candidate-01.jpg" alt="" loading="lazy" decoding="async" /><i className="live-pulse"></i></span>
                <div className="iv-labels">
                  <b>Priya Nair</b>
                  <em>Senior Product Designer · Live interview</em>
                </div>
              </div>
              <div className="iv-meta">
                <span className="iv-q">Question 2 of 8</span>
                <span className="iv-rec"><i></i>REC 04:12</span>
              </div>
            </div>

            <div className="panel-interview iv-surface" id="panelInterview">
              <div className="iv-video-lg">
                <picture>
                  <source srcSet="/assets/candidates/candidate-01.avif" type="image/avif" />
                  <source srcSet="/assets/candidates/candidate-01.webp" type="image/webp" />
                  <img loading="lazy" className="iv-photo"
                       src="/assets/candidates/candidate-01.jpg"
                       alt="Candidate on a live Recrewt AI video interview"
                       decoding="async" />
                </picture>
                <span className="iv-live-tag" aria-label="Live"><i></i>LIVE</span>
                <span className="iv-badge"><i></i>Priya Nair</span>
              </div>

              <div className="iv-transcript iv-grid">
                <div className="iv-turn turn-ai">
                  <span className="iv-ava" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 15.8l-1.6-4.8L6 9.4l4.4-1.6L12 3z"/></svg></span>
                  <div className="iv-bubble">
                    <p>Can you walk me through a time you solved a complex design problem?</p>
                    <span className="iv-ts">03:05</span>
                  </div>
                </div>
                <div className="iv-turn turn-me" id="ivAnswer">
                  <span className="iv-ava ava-c" aria-hidden="true">P</span>
                  <div className="iv-bubble">
                    <p>Sure. In my last role, we were redesigning our onboarding flow, but user drop-off was still high. I dug into the data and found that most users weren’t completing the key action because <mark id="ivPhrase">the value wasn’t clear early enough.</mark></p>
                    <span className="iv-ts">03:20</span>
                  </div>
                </div>
                <div className="iv-turn turn-follow" id="ivFollowup">
                  <span className="iv-ava" aria-hidden="true"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 15.8l-1.6-4.8L6 9.4l4.4-1.6L12 3z"/></svg></span>
                  <div className="iv-bubble">
                    <p><b>Follow-up:</b> What specific change did you make to make the value clearer?</p>
                    <span className="iv-ts">04:02</span>
                  </div>
                </div>
                <svg className="iv-connect" id="ivConnect">
                  <defs>
                    <marker id="ivArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                      <path d="M 0 0 L 10 5 L 0 10 z" fill="#FFD84D"/>
                    </marker>
                  </defs>
                  <path id="ivPath" d="" markerEnd="url(#ivArrow)"/>
                </svg>
              </div>
            </div>

            <div className="iv-foot">
              <div className="iv-progress">
                <div className="lbl">Progress</div>
                <div className="val">2<em>of 8 questions</em></div>
                <span className="iv-bar"><u></u></span>
              </div>
              <div className="iv-nextup">
                <span className="nextup-lbl">Next up</span>
                <span className="iv-next"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 15.8l-1.6-4.8L6 9.4l4.4-1.6L12 3z"/></svg>Tell me about a time you led through ambiguity</span>
                <span className="iv-next"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 15.8l-1.6-4.8L6 9.4l4.4-1.6L12 3z"/></svg>How do you approach user research?</span>
                <span className="iv-next iv-next-then"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 3l1.6 4.8L18 9.4l-4.4 1.6L12 15.8l-1.6-4.8L6 9.4l4.4-1.6L12 3z"/></svg>Describe your process from idea to ship</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>

    {/* 03 · centered header + full-width card + pillars (approved mockup) */}
    <article className="step3" id="chapter3">
      <div className="s3-head reveal">
        <span className="s1-num">Step 3 of 3</span>
        <h3 className="s1-title">Review the evidence.</h3>
        <p className="s3-sub">Each score links back to the answer that earned it. Watch the moment, read the reasoning, then decide.</p>
      </div>

      <div className="s3-card reveal">
        <div className="s3-conv">
          <div className="s3-cand">
            <b>Priya Nair</b>
            <em>Senior Product Designer · Interviewed 30 Sep 2026</em>
          </div>

          <div className="s3-stream">
            <div className="s3-q">
              <span className="s3-tag">AI Interviewer</span>
              <div className="s3-qtext">Tell me about your biggest product challenge in your last role.</div>
              <div className="s3-qts">00:21</div>
            </div>

            <div className="s3-turn">
              <div className="s3-ans">
                <div className="s3-arow">
                  <span className="s3-aav">P</span>
                  <span className="s3-albl">Priya</span>
                </div>
                <div className="s3-abody">I led the redesign of our onboarding experience. The main challenge was high drop-off in the first week. I ran user interviews, mapped friction points, and simplified the flow.</div>
                <div className="s3-ameta">
                  <span>01:02</span>
                  <span className="s3-wave" aria-hidden="true">
                    <b style={{height: "4px"}}></b><b style={{height: "7px"}}></b><b style={{height: "11px"}}></b><b style={{height: "6px"}}></b><b style={{height: "10px"}}></b><b style={{height: "14px"}}></b><b style={{height: "8px"}}></b><b style={{height: "5px"}}></b><b style={{height: "10px"}}></b><b style={{height: "7px"}}></b><b style={{height: "3px"}}></b><b style={{height: "9px"}}></b><b style={{height: "12px"}}></b><b style={{height: "6px"}}></b><b style={{height: "9px"}}></b><b style={{height: "5px"}}></b>
                  </span>
                  <span className="s3-mic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 12v1a6 6 0 0012 0v-1M12 19v2M9 21h6"/></svg></span>
                </div>
              </div>
              <div className="s3-an">
                <span className="s3-atag">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.6 4.8L18 8.4l-4.4 1.6L12 14.8l-1.6-4.8L6 8.4l4.4-1.6L12 2z"/></svg>
                  AI Analysis
                </span>
                <div className="s3-abody2">Strong ownership and impact mindset. Uses data and user research to identify the real problem. Clear, structured approach.</div>
                <div className="s3-ascore">8.5<em>/ 10</em></div>
              </div>
            </div>

            <div className="s3-q">
              <span className="s3-tag">AI Interviewer</span>
              <div className="s3-qtext">How did you measure success?</div>
              <div className="s3-qts">02:10</div>
            </div>

            <div className="s3-turn">
              <div className="s3-ans">
                <div className="s3-arow">
                  <span className="s3-aav">P</span>
                  <span className="s3-albl">Priya</span>
                </div>
                <div className="s3-abody">We tracked activation rate, time to value, and week-one retention. Activation improved by 32% and week-one retention by 18%.</div>
                <div className="s3-ameta">
                  <span>02:34</span>
                  <span className="s3-wave" aria-hidden="true">
                    <b style={{height: "4px"}}></b><b style={{height: "7px"}}></b><b style={{height: "11px"}}></b><b style={{height: "6px"}}></b><b style={{height: "10px"}}></b><b style={{height: "14px"}}></b><b style={{height: "8px"}}></b><b style={{height: "5px"}}></b><b style={{height: "10px"}}></b><b style={{height: "7px"}}></b><b style={{height: "3px"}}></b><b style={{height: "9px"}}></b><b style={{height: "12px"}}></b><b style={{height: "6px"}}></b><b style={{height: "9px"}}></b><b style={{height: "5px"}}></b>
                  </span>
                  <span className="s3-mic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M6 12v1a6 6 0 0012 0v-1M12 19v2M9 21h6"/></svg></span>
                </div>
              </div>
              <div className="s3-an">
                <span className="s3-atag">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.6 4.8L18 8.4l-4.4 1.6L12 14.8l-1.6-4.8L6 8.4l4.4-1.6L12 2z"/></svg>
                  AI Analysis
                </span>
                <div className="s3-abody2">Excellent use of metrics. Focuses on meaningful outcomes that tie back to user value. Demonstrates strong analytical thinking and clarity.</div>
                <div className="s3-ascore">9.2<em>/ 10</em></div>
              </div>
            </div>

            <div className="s3-more">
              <span>
                6 more answers
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </div>
          </div>
        </div>

        <div className="s3-dec">
          <div className="s3-video">
            <picture>
              <source srcSet="/assets/candidates/candidate-01.avif" type="image/avif" />
              <source srcSet="/assets/candidates/candidate-01.webp" type="image/webp" />
              <img loading="lazy" src="/assets/candidates/candidate-01.jpg" alt="Candidate on a recorded Recrewt interview" decoding="async" />
            </picture>
            <span className="s3-vts">18:04</span>
            <span className="s3-vic s3-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z"/></svg>
            </span>
          </div>

          <div className="s3-rec">
            <div className="s3-rlbl">Overall score</div>
            <div className="s3-rscore">8.4<em>/ 10</em></div>
            <div className="s3-rsuglbl">Suggested Outcome</div>
            <div className="s3-rsug">Shortlist</div>
            <div className="s3-rexp">Average of all 8 answers. The AI suggests, the recruiter makes the final call.</div>
          </div>

          <div className="s3-divider"></div>

          <div className="s3-rec">
            <div className="s3-dtitle">Recruiter Decision <span className="s3-info">i</span></div>
            <div className="s3-btns">
              <button className="s3-btn s3-short" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="5 12 10 17 20 7"/></svg>
                Shortlist
              </button>
              <button className="s3-btn s3-hold" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v4.5M12 15.5v.5"/></svg>
                Hold
              </button>
              <button className="s3-btn s3-reject" type="button">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M7 7l10 10M17 7L7 17"/></svg>
                Reject
              </button>
            </div>
            <p className="s3-dnote">Nothing happens until you choose.</p>
          </div>
        </div>
      </div>

      <div className="s3-pillars reveal">
        <div className="s3-pillar">
          <span className="s3-pic"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l1.6 4.8L18 8.4l-4.4 1.6L12 14.8l-1.6-4.8L6 8.4l4.4-1.6L12 2z"/></svg></span>
          <div>
            <b>Scored answer by answer.</b>
            <p>Each reply is rated for quality, depth and clarity.</p>
          </div>
        </div>
        <div className="s3-pillar">
          <span className="s3-pic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M9 6h11M9 12h11M9 18h7M4.5 6h.01M4.5 12h.01M4.5 18h.01"/></svg></span>
          <div>
            <b>Reasons for every score.</b>
            <p>Plain-language notes, not a black box.</p>
          </div>
        </div>
        <div className="s3-pillar">
          <span className="s3-pic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="3.6"/><path d="M4 21a8 8 0 0116 0"/></svg></span>
          <div>
            <b>Your decision. Always.</b>
            <p>You stay in control of every hire.</p>
          </div>
        </div>
      </div>
    </article>
  </div>
</section>

{/* ============================================================
     SECTION — Built for your process (editorial closer)
     ============================================================ */}
<section className="fit" aria-labelledby="fit-heading">
  <div className="container">
    <div className="fit-head reveal">
      <span className="fit-label">Built for your process</span>
      <h2 className="fit-h" id="fit-heading">
        Keep your hiring process.<br />
        <span className="l2">
          <em>Upgrade the interview.</em>
          <span className="under" aria-hidden="true">
            <svg viewBox="0 0 600 12" preserveAspectRatio="none">
              <path d="M 6 9 Q 300 -2 594 7" stroke="#FFD84D" strokeWidth="5" fill="none" strokeLinecap="round"/>
            </svg>
          </span>
        </span>
      </h2>
      <p className="fit-sub">Recrewt fits into the process you already run. It handles the first interview and the evidence behind each score. Your team keeps the rest.</p>
    </div>
  </div>

  <div className="fit-timeline reveal">
    <div className="fit-stages">
      <div className="fit-stage">
        <span className="fit-node" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 3h7l4 4v13a1.5 1.5 0 01-1.5 1.5h-9.5A1.5 1.5 0 015.5 20V4.5A1.5 1.5 0 017 3z"/>
            <path d="M14 3v4h4"/>
            <path d="M9 13h6M9 17h4"/>
          </svg>
        </span>
        <span className="fit-name">Application</span>
      </div>

      <div className="fit-stage on">
        <span className="fit-node" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="13" height="12" rx="2"/>
            <path d="M16 10.5l5-3v9l-5-3z"/>
          </svg>
        </span>
        <span className="fit-name">Interview</span>
      </div>

      <div className="fit-stage on">
        <span className="fit-node" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="5" y="13" width="3.5" height="7" rx="0.6"/>
            <rect x="10.25" y="7" width="3.5" height="13" rx="0.6"/>
            <rect x="15.5" y="10" width="3.5" height="10" rx="0.6"/>
          </svg>
        </span>
        <span className="fit-name">Evidence</span>
      </div>

      <div className="fit-stage">
        <span className="fit-node" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <polyline points="8 12 11 15 16 9"/>
          </svg>
        </span>
        <span className="fit-name">Decision</span>
      </div>

      <div className="fit-stage">
        <span className="fit-node" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="13" rx="1.5"/>
            <path d="M3 8l9 6 9-6"/>
          </svg>
        </span>
        <span className="fit-name">Offer</span>
      </div>

      <div className="fit-annotation">
        <svg className="fit-brace" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 2 2 C 2 10, 4 14, 10 14 C 30 14, 40 17, 46 17 L 50 20 L 54 17 C 60 17, 70 14, 90 14 C 96 14, 98 10, 98 2"/>
        </svg>
        <div className="fit-caption">Recrewt handles these two</div>
      </div>
    </div>
  </div>
</section>

{/* ============================================================
     SECTION — Trust. Answers the questions HR buyers ask first.
     Every answer matches the interview consent screen and /privacy.
     If either of those changes, update this section too.
     ============================================================ */}
<section className="trust" id="trust" aria-labelledby="trust-heading">
  <div className="container">
    <div className="tr-head">
      <span className="tr-label">Trust</span>
      <h2 id="trust-heading">What hiring teams ask us <em>first.</em></h2>
    </div>
    <div className="tr-grid">
      <div className="tr-item">
        <h3>Do candidates know they&rsquo;re talking to AI?</h3>
        <p>Yes. Before the interview starts, candidates tick a box agreeing to be recorded and to their answers being analysed by AI. Then the interviewer introduces itself as the AI interviewer.</p>
      </div>
      <div className="tr-item">
        <h3>Does the AI decide who gets hired?</h3>
        <p>No. It scores answers and suggests a next step. A person on your team makes every decision.</p>
      </div>
      <div className="tr-item">
        <h3>Is every candidate judged the same way?</h3>
        <p>Candidates for the same role get the same core questions and the same scoring rubric. Follow-ups change based on what each person says.</p>
      </div>
      <div className="tr-item">
        <h3>What happens to candidate data?</h3>
        <p>Only the recruiter who created the role can see it. It&rsquo;s kept until you delete the role or ask us to, then permanently removed within 30 days. Candidates can ask for their data to be erased at any time. <a className="tr-link" href="/privacy">Read the privacy policy</a></p>
      </div>
    </div>
  </div>
</section>

{/* ============================================================
     SECTION — Pricing (editorial, premium, three equal cards)
     Structure mirrors the recruiter Billing surface: plan name +
     large price + short blurb, hairline divider, WHAT'S INCLUDED
     eyebrow, three stacked usage rows (icon + big value + label),
     hairline divider, checkmark features, CTA pinned to the foot.
     Scale carries a subtle yellow ribbon + small MOST POPULAR pill.
     No billing toggle, no promo badges — this section presents the
     plans; subscription flow lives on /subscription.
     ============================================================ */}
<section className="pricing" id="pricing" aria-labelledby="pricing-heading">
  <div className="container">
    <div className="pr-head reveal">
      <span className="pr-label">Pricing</span>
      <h2 id="pricing-heading">Choose the plan that <em>fits your hiring.</em></h2>
      <p>Pick the volume that matches how you hire today. Every plan includes the full interview, scoring and evidence workflow.</p>
    </div>

    <div className="pr-grid reveal">
      <PricingCard
        name="Growth"
        price="$420"
        priceSuffix="/ month"
        blurb="For small teams hiring every month. Works out at $2.10 per candidate."
        limits={[
          { type: 'candidates', value: '200', label: 'Candidates / month' },
          { type: 'roles',      value: '10',  label: 'Active hiring roles' },
        ]}
        features={[
          'Fully automated screening',
          'AI writes interview questions',
          'Video interviews on autopilot',
          'Auto-scoring, transcript & speech analysis',
          'Share results with your team by link',
          'Email support',
        ]}
        cta={{ label: 'Get started', variant: 'secondary', href: 'https://checkout.dodopayments.com/buy/pdt_0Nk2h5VbmxX3JNDLIKz1P?redirect_url=https%3A%2F%2Frecrewtai.com%2Flogin%3Fnext%3D%2Fsubscription' }}
      />

      {/* Growth and Scale run the same product. The old list sold
          sentiment analysis, the score breakdown, CSV invites and the
          progress dashboard as Scale-only — nothing in the codebase gates
          any of them, so every Growth customer already had the lot.
          Volume and support are the honest differences. */}
      <PricingCard
        state="featured"
        badgeLabel="Best value"
        name="Scale"
        price="$620"
        priceSuffix="/ month"
        blurb="For teams running several roles at once. Works out at $1.24 per candidate."
        limits={[
          { type: 'candidates', value: '500',       label: 'Candidates / month' },
          { type: 'roles',      value: 'Unlimited', label: 'Active hiring roles' },
        ]}
        featuresHeading="Everything in Growth, plus:"
        features={[
          'Priority support',
        ]}
        cta={{ label: 'Get started', variant: 'primary', href: 'https://checkout.dodopayments.com/buy/pdt_0Nk2hHWPwycoOZW6NdF3T?redirect_url=https%3A%2F%2Frecrewtai.com%2Flogin%3Fnext%3D%2Fsubscription' }}
      />

      <PricingCard
        name="Enterprise"
        price="Custom"
        priceSuffix="pricing"
        blurb="For high-volume hiring. Priced on your volume."
        limits={[
          { type: 'candidates', value: 'Unlimited', label: 'Candidates / month' },
          { type: 'roles',      value: 'Unlimited', label: 'Active hiring roles' },
        ]}
        featuresHeading="Everything in Scale, plus:"
        features={[
          'Interview design with our team',
          'Dedicated account manager',
          'Custom onboarding and training',
        ]}
        cta={{
          label: 'Book a demo',
          variant: 'secondary',
          href: 'https://calendly.com/mike-recrewtai',
        }}
      />
    </div>

    {/* Trust statement — understated primary line about what every
        plan shares. Kept truthful: no "credit card required" copy
        because Recrewt is paid SaaS. */}
    <p className="pr-trust reveal">
      All plans include secure cloud hosting and automatic AI improvements.
    </p>
    {/* Quieter secondary — flexibility signal. Reduces purchase
        anxiety and communicates that a plan choice today isn't
        permanent. */}
    <p className="pr-foot reveal">Change or cancel your plan any time.</p>
  </div>
</section>

{/* ============================================================
     SECTION — Closing CTA + Footer (final chapter)
     ============================================================ */}
<section className="cta" id="book" aria-labelledby="cta-heading">
  <div className="cta-inner">
    <span className="cta-label reveal">Ready when you are</span>
    <h2 id="cta-heading" className="cta-h reveal">
      Hiring is important.<br />
      <em>So is your time.</em>
    </h2>
    <p className="cta-copy reveal">Recrewt runs the first interview with every applicant, so your team only meets the people worth meeting.</p>
    <div className="cta-actions reveal">
      <div className="cta-btns">
        <a className="cta-btn cta-btn-pri" href="#pricing">Get started <span className="arrow" aria-hidden="true">→</span></a>
        <a className="cta-btn" href="https://calendly.com/mike-recrewtai" target="_blank" rel="noopener noreferrer">Book a 15-minute demo</a>
      </div>
      <p className="cta-note">No commitment. Just a conversation about how you hire.</p>
    </div>
  </div>
</section>

<footer className="ft reveal">
  <div className="ft-container">
    <div className="ft-row">
      <a className="ft-logo" href="#hero" aria-label="Recrewt AI — back to top">
        <img src="/assets/recrewt-logo-tight.png" alt="Recrewt AI" width="711" height="172" loading="lazy" decoding="async" />
      </a>
      <nav className="ft-nav" aria-label="Footer navigation">
        <a href="#how-it-works">How it works</a>
        <a href="#pricing">Pricing</a>
        <a href="#trust">Trust</a>
        <a href="/privacy">Privacy</a>
        <a href="/terms">Terms</a>
      </nav>
      <a className="ft-email" href="mailto:hello@recrewtai.com">hello@recrewtai.com</a>
    </div>
    <div className="ft-bottom">
      <span>© {new Date().getFullYear()} Recrewt AI. All rights reserved.</span>
    </div>
  </div>
</footer>
    </div>
  );
}

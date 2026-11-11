(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.add('js');   // CSS only hides the contact reveal when this script is running

  var $ = function (s) { return document.querySelector(s); };
  var clamp = function (x, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, x)); };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a)); };                       // 0..1 inside [a, b]
  var inOut = function (t) { return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };   // smooth start and end
  var easeOut = function (t) { return 1 - Math.pow(1 - t, 3); };
  var settle = function (t) { var c1 = .32, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); }; // lands with a soft, understated rebound

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var story = $('#story'), stage = $('#stage'), hero = $('#hero');
  var lMove = $('#laptopMove'), lZoom = $('#laptopZoom'), lScreen = $('#laptopScreen'), deskImg = $('#deskImg');
  var pMove = $('#phoneMove'),  pZoom = $('#phoneZoom'),  pScreen = $('#phoneScreen'),  mobImg = $('#mobImg');
  var capDesk = $('#capDesk'), capMob = $('#capMob'), bar = $('#progress');

  /* ---------- Magic pouch: where the laptop and phone fly off to ---------- */
  var buddyEl = $('#buddy'), pouchMouth = document.querySelector('.pouch-mouth'), pouchGlow = document.querySelector('.pouch-glow');
  var pouchDX = -200, pouchDY = 200;            // recomputed to the real pouch position in measure()
  var gulpedL = false, gulpedP = false;
  function gulp() {
    if (!window.gsap) { return; }
    gsap.timeline()
      .to(buddyEl, { scale: 1.12, y: -5, duration: .14, ease: 'power2.out' }, 0)
      .to(pouchMouth, { scaleY: 2.1, scaleX: 1.12, transformOrigin: '50% 50%', duration: .12, ease: 'power2.out' }, 0)
      .to(pouchGlow, { opacity: .85, scale: 1.7, transformOrigin: '50% 50%', duration: .14, ease: 'power1.out' }, 0)
      .to(buddyEl, { scale: 1, y: 0, duration: .5, ease: 'elastic.out(1,.55)' }, .16)
      .to(pouchMouth, { scaleY: 1, scaleX: 1, duration: .3, ease: 'power2.inOut' }, .18)
      .to(pouchGlow, { opacity: 0, scale: 1, duration: .4, ease: 'power1.in' }, .2);
  }

  /* ---------- Scroll story ---------- */
  var scrub = !reduce;
  var vw = 0, vh = 0, storyTop = 0, storyRange = 1;
  var gL = null, gP = null, sL = 1, sP = 1, panL = 0, panP = 0;
  var ticking = false, cur = 0, lastSay = -1;
  var impact = $("#impact"), bubble = $("#bubble");
  var C0 = [[169,201,216],[193,215,229]], C1 = [[201,197,232],[224,217,240]];
  var bump = function (t) { return Math.sin(Math.PI * t); };   // 0 at top and bottom, 1 mid-page: deep blue, then lighter, then deep again
  var mix = function (a, b, t) { return a.map(function (v, i) { return Math.round(v + (b[i] - v) * t); }).join(","); };
  var LINES = [[0,"Hi, I'm Sara! Scroll down and I'll show you around."],[.05,"This is my CV website on desktop."],[.14,"Zooming in so you can see every detail!"],[.45,"Now let's check the mobile version..."],[.575,"Whoa! It landed!"],[.67,"Smooth on a phone too, right?"],[.97,"Keep scrolling: my profile is next!"]];
  var SECTION_LINES = { about: "That's my profile! Let me introduce myself.", skills: "These are my skills. Hover over a card!", education: "Here's where I study.", experience: "A few projects I've built so far.", contact: "Say hello! I'd love to hear from you." };
  var secNow = null, hopT, quietT;
  var hop = function () { buddyEl.classList.add("walking"); clearTimeout(hopT); hopT = setTimeout(function () { buddyEl.classList.remove("walking"); }, 1300); };
  var speak = function (t) { if (bubble.textContent === t) { return; } bubble.textContent = t; bubble.classList.remove("pop2"); void bubble.offsetWidth; bubble.classList.add("pop2"); bubble.classList.remove("quiet"); clearTimeout(quietT); quietT = setTimeout(function () { bubble.classList.add("quiet"); }, 5200); hop(); };
  var say = function (p) { if (secNow) { return; } var i = 0; LINES.forEach(function (l, n) { if (p >= l[0]) { i = n; } }); if (i !== lastSay) { lastSay = i; speak(LINES[i][1]); } };

  if (scrub) { root.classList.add('scrub'); }

  // Where a screen sits inside its device, and how far to scale/move it to reach the viewport centre
  function geometry(zoomEl, screenEl) {
    var st = stage.getBoundingClientRect();
    var dr = zoomEl.getBoundingClientRect();
    var sr = screenEl.getBoundingClientRect();
    var cx = sr.left + sr.width / 2, cy = sr.top + sr.height / 2;
    return {
      ox: cx - dr.left, oy: cy - dr.top,
      tx: st.left + st.width / 2 - cx, ty: st.top + st.height / 2 - cy,
      w: sr.width, h: sr.height
    };
  }

  function measure() {
    if (!scrub) { return; }
    // measure with every transform removed
    [lMove, lZoom, pMove, pZoom].forEach(function (el) { el.style.transform = 'none'; });
    stage.style.transform = 'none';
    vw = stage.clientWidth; vh = stage.clientHeight;
    var r = story.getBoundingClientRect();
    storyTop = r.top + window.scrollY;
    storyRange = Math.max(1, story.offsetHeight - vh);

    gL = geometry(lZoom, lScreen);
    gP = geometry(pZoom, pScreen);
    lZoom.style.transformOrigin = gL.ox + 'px ' + gL.oy + 'px';
    pZoom.style.transformOrigin = gP.ox + 'px ' + gP.oy + 'px';

    var cover = Math.max(vw / gL.w, vh / gL.h) * 1.01;
    var fit = Math.min(vw / gL.w, vh / gL.h);
    sL = (vw / vh > 1.2) ? cover : fit;                                   // wide screens: fill it; tall screens: fit the width
    sP = Math.min(vh * .94 / gP.h, vw * .94 / gP.w);                      // phone: almost full height

    // how far each screenshot can slide inside its screen
    panL = deskImg.offsetHeight ? Math.max(0, 1 - lScreen.offsetHeight / deskImg.offsetHeight) * 100 : 0;
    panP = mobImg.offsetHeight ? Math.max(0, 1 - pScreen.offsetHeight / mobImg.offsetHeight) * 100 : 0;

    // real screen position of the buddy's pouch, so the devices fly to the right spot
    var br = (document.querySelector('.pouch') || buddyEl).getBoundingClientRect();
    pouchDX = (br.left + br.width * .5) - vw / 2;
    pouchDY = (br.top + br.height * .3) - vh / 2;

    cur = clamp((window.scrollY - storyTop) / storyRange);
    render();
  }

  // eased progress: the scene glides after the scroll wheel instead of jumping with it
  function tick() {
    var t = clamp((window.scrollY - storyTop) / storyRange);
    cur += (t - cur) * .1;
    if (Math.abs(t - cur) < .0004) { cur = t; }
    render();
    if (cur !== t) { requestAnimationFrame(tick); } else { ticking = false; }
  }

  function render() {
    if (!scrub || !gL) { return; }
    var p = cur;

    /* Scene 1: intro fades up and away */
    var h = inOut(seg(p, 0, .06));
    hero.style.opacity = 1 - h;
    hero.style.transform = 'translate3d(0,' + (-h * 9) + 'vh,0)';

    /* Scene 2: desktop rises in, zooms to full screen, pans, then flies off into the pouch */
    var lin = easeOut(seg(p, .05, .115));
    var lout = inOut(seg(p, .47, .565));                 // 0..1 across the whole exit flight
    var lFade = seg(p, .51, .565);                        // only fades in the last stretch, so the flight reads clearly
    var liftY = (1 - lin) * .14 * vh;
    lMove.style.opacity = lin * (1 - lFade);
    lMove.style.transform = 'translate3d(' + (lout * pouchDX) + 'px,' + (liftY + lout * pouchDY) + 'px,0) rotate(' + (lout * -24) + 'deg) scale(' + ((.94 + .06 * lin) * (1 - lout * .82)) + ')';
    if (lout > .9 && !gulpedL) { gulpedL = true; gulp(); }
    if (lout < .25) { gulpedL = false; }

    var zL = inOut(seg(p, .14, .26)) * (1 - inOut(seg(p, .38, .47)));
    lZoom.style.setProperty('--z', zL);
    lZoom.style.transform = 'translate3d(' + (gL.tx * zL) + 'px,' + (gL.ty * zL) + 'px,0) scale(' + (1 + (sL - 1) * zL) + ')';
    deskImg.style.transform = 'translate3d(0,' + (-inOut(seg(p, .26, .34)) * (1 - inOut(seg(p, .34, .42))) * panL) + '%,0)';

    /* Scene 3: phone falls in from the top while turning from landscape to portrait */
    var fall = settle(seg(p, .50, .62));
    var rot = (1 - inOut(seg(p, .52, .64))) * 90;
    var pSuck = inOut(seg(p, .935, .995));                // then flies off into the pouch at the very end
    pMove.style.visibility = p > .495 ? 'visible' : 'hidden';
    pMove.style.opacity = 1 - seg(p, .96, .998);
    pMove.style.transform = 'translate3d(' + (pSuck * pouchDX) + 'px,' + (-(1 - fall) * 1.15 * vh + pSuck * pouchDY) + 'px,0) rotate(' + (rot + pSuck * 240) + 'deg) scale(' + (1 - pSuck * .85) + ')';
    if (pSuck > .9 && !gulpedP) { gulpedP = true; gulp(); }
    if (pSuck < .25) { gulpedP = false; }

    var zP = inOut(seg(p, .68, .80)) * (1 - inOut(seg(p, .87, .935)));
    pZoom.style.setProperty('--z', zP);
    pZoom.style.transform = 'translate3d(' + (gP.tx * zP) + 'px,' + (gP.ty * zP) + 'px,0) scale(' + (1 + (sP - 1) * zP) + ')';
    mobImg.style.transform = 'translate3d(0,' + (-inOut(seg(p, .79, .86)) * (1 - inOut(seg(p, .86, .92))) * panP) + '%,0)';

    /* buddy points toward the stage while either device is in frame, otherwise idle-waves */
    buddyEl.classList.toggle('point', (zL > .04 && zL < .97) || (zP > .04 && zP < .97));

    /* phone landing: ring + a brief, understated screen shake */
    var k = seg(p, .575, .68), on = k > 0 && k < 1;
    impact.style.opacity = on ? (1 - k) * .55 : 0;
    impact.style.transform = 'scale(' + (.3 + k * 2.2) + ')';
    var sh = on ? Math.sin(k * 26) * (1 - k) * (1 - k) * 5 : 0;
    stage.style.transform = 'translate3d(' + sh + 'px,' + (-sh * .6) + 'px,0)';
    say(p);

    /* small labels */
    capDesk.style.opacity = seg(p, .115, .14) * (1 - seg(p, .44, .48)) * (1 - clamp(zL * 4));
    capMob.style.opacity = seg(p, .62, .66) * (1 - seg(p, .91, .95)) * (1 - clamp(zP * 4));
  }

  function onScroll() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? clamp(window.scrollY / max) : 0) + ')';
    if (scrub && !ticking) { ticking = true; requestAnimationFrame(tick); }
    var pp = max > 0 ? clamp(window.scrollY / max) : 0;   // whole page: cream gets darker going down, lighter going up
    root.style.setProperty('--g1', 'rgb(' + mix(C0[0], C1[0], bump(pp)) + ')');
    root.style.setProperty('--g2', 'rgb(' + mix(C0[1], C1[1], bump(pp)) + ')');
  }

  var resizeTimer;
  window.addEventListener('resize', function () { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 120); });
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('load', measure);
  deskImg.addEventListener('load', measure);
  mobImg.addEventListener('load', measure);
  measure();
  onScroll();

  /* ---------- Intro: doors split open, then the hero animates in ---------- */
  var intro = $('#intro');
  if (reduce) { root.classList.add('ready'); }
  else {
    setTimeout(function () { intro.classList.add('open'); }, 1000);
    setTimeout(function () { root.classList.add('ready'); buddyEl.classList.add('walking'); }, 1500);
    setTimeout(function () { buddyEl.classList.remove('walking'); measure(); quietT = setTimeout(function () { bubble.classList.add('quiet'); }, 4000); }, 4500);   // Sara has arrived: re-measure where her tote is
    setTimeout(function () { intro.classList.add('done'); }, 2600);
  }

  /* ---------- Nav links ---------- */
  document.querySelectorAll('.nav a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var behavior = reduce ? 'auto' : 'smooth';
      var p = a.getAttribute('data-p');
      if (scrub && p !== null) {                       // jump to a moment of the story
        e.preventDefault();
        window.scrollTo({ top: storyTop + parseFloat(p) * storyRange, behavior: behavior });
        return;
      }
      var target = document.querySelector(a.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: behavior }); }
    });
  });

  /* ---------- Contact section: reveal on scroll ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('show'); io.unobserve(en.target); setTimeout(function () { en.target.style.transitionDelay = '0s'; }, 1500); } });
    }, { threshold: .15 });
    reveals.forEach(function (el) { var i = Array.prototype.indexOf.call(el.parentNode.children, el); el.style.transitionDelay = ((i % 6) * 0.1) + 's'; io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('show'); });
  }

  /* ---------- Sara talks about whichever section is in view ---------- */
  if ('IntersectionObserver' in window) {
    var so = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        var id = en.target.id;
        if (en.isIntersecting) { secNow = id; speak(SECTION_LINES[id]); }
        else if (secNow === id) { secNow = null; lastSay = -1; if (scrub) { say(cur); } }
      });
    }, { rootMargin: '-45% 0px -45% 0px' });
    Object.keys(SECTION_LINES).forEach(function (id) { var s = document.getElementById(id); if (s) { so.observe(s); } });

    /* count-up numbers in the About stats */
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) { return; }
        co.unobserve(en.target);
        var el = en.target, to = +el.getAttribute('data-count'), t0 = performance.now();
        (function step(now) { var k = Math.min(1, (now - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) { requestAnimationFrame(step); } })(t0);
      });
    }, { threshold: .6 });
    document.querySelectorAll('[data-count]').forEach(function (el) { co.observe(el); });
  } else { document.querySelectorAll('[data-count]').forEach(function (el) { el.textContent = el.getAttribute('data-count'); }); }

  /* ---------- Contact form ---------- */
  var form = $('#contactForm');
  if (form) {
    var msg = $('#formMsg');
    var fields = { name: $('#name'), email: $('#email'), message: $('#message') };

    var show = function (text, ok) { msg.textContent = text; msg.className = 'msg ' + (ok ? 'ok' : 'err'); };   // textContent: safe for user text
    var fail = function (text, field) {
      Object.keys(fields).forEach(function (k) { fields[k].classList.remove('invalid'); });
      field.classList.add('invalid');
      field.focus();
      show(text, false);
    };

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var name = fields.name.value.trim();
      var email = fields.email.value.trim();
      var text = fields.message.value.trim();

      if (name.length < 2) { return fail('Please enter your name.', fields.name); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { return fail('Please enter a valid email address.', fields.email); }
      if (text.length < 10) { return fail('Your message should be at least 10 characters.', fields.message); }

      Object.keys(fields).forEach(function (k) { fields[k].classList.remove('invalid'); });
      show('Thank you, ' + name + '! Your email app will open with the message ready to send.', true);

      // No backend yet, so the message is handed to the visitor's email app
      var subject = encodeURIComponent('Portfolio message from ' + name);
      var body = encodeURIComponent(text + '\n\nFrom: ' + name + ' (' + email + ')');
      window.location.href = 'mailto:itssara198@gmail.com?subject=' + subject + '&body=' + body;
      form.reset();
    });
  }

  /* ---------- Footer year ---------- */
  var yr = $('#year');
  if (yr) { yr.textContent = new Date().getFullYear(); }
})();

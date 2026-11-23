"use client";

import { useEffect } from "react";

/**
 * PureFibre Call Navigator - live-call SOP/script reference for the TELUS
 * PureFibre winback cold-calling script (separate client work, not VA
 * Atelier students). Ported from a standalone HTML tool into this app so
 * Reymar has one-stop access from the admin portal he already uses daily.
 *
 * All CSS classes, the CSS custom-property scope, and the global helper
 * function names are prefixed with "pfn-" / "pfn" specifically so nothing
 * here can collide with the app's existing global styles (globals.css
 * already defines .card, .btn-primary, .btn-secondary, .input) or with any
 * other script on the page. Do not remove the prefixing when editing this
 * file - it's the only thing keeping this page's styles from leaking onto
 * every other admin page (and vice versa).
 */

const PFN_CSS = `
.pfn-root{
    /* layout: sticky top bar (title + live search) over a single scrolling
       column; quick-facts + quick-jump grid, then step-by-step call flow,
       then a searchable objection-handling library, each as native
       <details> accordions so the whole page works with zero JS if needed */
    --bg:#f3f6f7; --surface:#ffffff; --fg:#10242b; --muted:#5b7279;
    --accent:#0f8b8d; --accent-fg:#ffffff; --accent-soft:#e6f2f2;
    --good:#1a7f5a; --good-soft:#e3f5ee;
    --warn-bg:#fff4e5; --warn-fg:#8a4b00; --warn-border:#f0b429;
    --border:#dbe4e6; --shadow:0 1px 2px rgba(16,36,43,.06),0 4px 16px rgba(16,36,43,.05);
  }
  @media (prefers-color-scheme: dark){
    .pfn-root:not([data-theme="light"]){
      --bg:#0b1416; --surface:#121e21; --fg:#e7f1f2; --muted:#93acb1;
      --accent:#35c6c3; --accent-fg:#052423; --accent-soft:#16282b;
      --good:#3ddb9b; --good-soft:#102620;
      --warn-bg:#2a2110; --warn-fg:#f3c764; --warn-border:#8a6a1f;
      --border:#203134; --shadow:0 1px 2px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.25);
      color-scheme: dark;
    }
  }
  .pfn-root[data-theme="dark"]{
    --bg:#0b1416; --surface:#121e21; --fg:#e7f1f2; --muted:#93acb1;
    --accent:#35c6c3; --accent-fg:#052423; --accent-soft:#16282b;
    --good:#3ddb9b; --good-soft:#102620;
    --warn-bg:#2a2110; --warn-fg:#f3c764; --warn-border:#8a6a1f;
    --border:#203134; --shadow:0 1px 2px rgba(0,0,0,.3),0 4px 16px rgba(0,0,0,.25);
    color-scheme: dark;
  }
  .pfn-root, .pfn-root *{box-sizing:border-box;}
  .pfn-root{
    background:var(--bg); color:var(--fg);
    font-family:'Inter',system-ui,-apple-system,sans-serif;
    font-size:15px; line-height:1.5;
    padding-left:max(16px, env(safe-area-inset-left,0px));
    padding-right:max(16px, env(safe-area-inset-right,0px));
  }
  .pfn-root h1,.pfn-root h2,.pfn-root h3,.pfn-root h4{font-family:'Space Grotesk','Inter',system-ui,sans-serif; text-wrap:balance; margin:0;}
  .pfn-root a{color:var(--accent);}
  .pfn-wrap{max-width:760px; margin:0 auto;}

  /* ---------- sticky header ---------- */
  .pfn-topbar{
    position:sticky; top:calc(var(--pfn-navbar-offset, 0px) + env(safe-area-inset-top,0px)); z-index:30;
    background:var(--bg);
    padding-top:calc(env(safe-area-inset-top,0px) + 14px);
    padding-bottom:10px;
    border-bottom:1px solid var(--border);
  }
  .pfn-topbar-row{display:flex; align-items:center; gap:10px;}
  .pfn-brand{display:flex; align-items:center; gap:10px; flex:1; min-width:0;}
  .pfn-brand-mark{
    width:34px; height:34px; border-radius:9px; flex:none;
    background:linear-gradient(135deg, var(--accent), var(--good));
    display:flex; align-items:center; justify-content:center;
    color:var(--accent-fg); font-family:'Space Grotesk',sans-serif; font-weight:700; font-size:15px;
  }
  .pfn-brand-text{min-width:0;}
  .pfn-brand-text h1{font-size:16px; font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
  .pfn-brand-text p{margin:0; font-size:11px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;}
  .pfn-menu-btn{
    flex:none; width:38px; height:38px; border-radius:9px; border:1px solid var(--border);
    background:var(--surface); color:var(--fg); font-size:17px; cursor:pointer;
    display:none; align-items:center; justify-content:center;
  }
  .pfn-search-row{margin-top:10px; position:relative;}
  .pfn-search-row input{
    width:100%; padding:10px 36px 10px 14px; border-radius:10px; border:1px solid var(--border);
    background:var(--surface); color:var(--fg); font-size:14px; font-family:inherit;
  }
  .pfn-search-row input:focus{outline:2px solid var(--accent); outline-offset:1px;}
  .pfn-search-clear{
    position:absolute; right:6px; top:50%; transform:translateY(-50%);
    border:none; background:transparent; color:var(--muted); font-size:15px; cursor:pointer;
    width:26px; height:26px; border-radius:6px; display:none;
  }
  .pfn-search-clear.pfn-show{display:block;}
  .pfn-no-results{display:none; text-align:center; color:var(--muted); padding:40px 10px; font-size:14px;}
  .pfn-no-results.pfn-show{display:block;}

  /* ---------- nav drawer (quick jump) ---------- */
  .pfn-nav-grid{
    display:grid; grid-template-columns:repeat(2,1fr); gap:8px; margin:14px 0 18px;
  }
  @media (min-width:560px){ .pfn-nav-grid{grid-template-columns:repeat(3,1fr);} }
  .pfn-nav-grid a{
    display:block; padding:9px 10px; border-radius:9px; background:var(--surface);
    border:1px solid var(--border); color:var(--fg); text-decoration:none; font-size:12.5px;
    font-weight:600; text-align:center;
  }
  .pfn-nav-grid a:hover{border-color:var(--accent); color:var(--accent);}

  /* ---------- section cards ---------- */
  .pfn-root section{margin-bottom:22px;}
  .pfn-section-head{display:flex; align-items:baseline; gap:8px; margin-bottom:10px;}
  .pfn-section-head h2{font-size:13px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted);}
  .pfn-section-head .pfn-count{font-size:11px; color:var(--muted); background:var(--accent-soft); padding:2px 8px; border-radius:999px;}

  details.pfn-card{
    background:var(--surface); border:1px solid var(--border); border-radius:14px;
    box-shadow:var(--shadow); margin-bottom:10px; overflow:hidden;
  }
  details.pfn-card > summary{
    list-style:none; cursor:pointer; padding:13px 16px; display:flex; align-items:center; gap:10px;
    font-family:'Space Grotesk',sans-serif; font-weight:600; font-size:14.5px;
  }
  details.pfn-card > summary::-webkit-details-marker{display:none;}
  details.pfn-card > summary::before{
    content:"+"; flex:none; width:22px; height:22px; border-radius:7px; background:var(--accent-soft);
    color:var(--accent); display:flex; align-items:center; justify-content:center; font-size:15px; font-weight:700;
  }
  details.pfn-card[open] > summary::before{content:"–";}
  .pfn-step-num{
    flex:none; width:24px; height:24px; border-radius:50%; background:var(--accent); color:var(--accent-fg);
    font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center;
  }
  .pfn-card-body{padding:0 16px 16px;}

  /* nested objection accordions inside a category card */
  details.pfn-objection{border:1px solid var(--border); border-radius:10px; margin-top:8px; background:var(--bg);}
  details.pfn-objection > summary{
    list-style:none; cursor:pointer; padding:10px 12px; font-size:13.5px; font-weight:600;
    display:flex; gap:8px; align-items:flex-start;
  }
  details.pfn-objection > summary::-webkit-details-marker{display:none;}
  details.pfn-objection > summary::before{content:"▸"; color:var(--muted); flex:none; font-size:11px; margin-top:3px;}
  details.pfn-objection[open] > summary::before{content:"▾";}
  .pfn-obj-body{padding:0 12px 12px 30px;}

  .pfn-script-block{
    background:var(--accent-soft); border-radius:10px; padding:11px 12px; margin:8px 0;
    display:flex; gap:10px; align-items:flex-start;
  }
  .pfn-script-block .pfn-script-text{margin:0; flex:1; min-width:0;}
  .pfn-script-block .pfn-script-text em{font-style:normal; color:var(--muted);}
  .pfn-copy-btn{
    flex:none; border:1px solid var(--border); background:var(--surface); color:var(--fg);
    font-size:11.5px; font-weight:600; padding:6px 10px; border-radius:8px; cursor:pointer;
    font-family:inherit;
  }
  .pfn-copy-btn:hover{border-color:var(--accent); color:var(--accent);}
  .pfn-copy-btn.pfn-copied{background:var(--good); border-color:var(--good); color:#fff;}

  .pfn-wait-note{font-size:12px; color:var(--muted); margin:6px 0 0; font-style:italic;}
  .pfn-callout{
    border-radius:10px; padding:11px 12px; margin:10px 0; font-size:13.5px; display:flex; gap:9px;
  }
  .pfn-callout.pfn-warn{background:var(--warn-bg); color:var(--warn-fg); border:1px solid var(--warn-border);}
  .pfn-callout.pfn-good{background:var(--good-soft); color:var(--good); border:1px solid var(--good);}
  .pfn-callout b{display:block; margin-bottom:2px;}

  /* quick facts */
  .pfn-facts-grid{display:grid; grid-template-columns:1fr; gap:8px;}
  @media (min-width:560px){ .pfn-facts-grid{grid-template-columns:1fr 1fr;} }
  .pfn-fact{
    background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 12px;
    display:flex; justify-content:space-between; gap:10px; font-size:13px;
  }
  .pfn-fact .pfn-k{color:var(--muted);}
  .pfn-fact .pfn-v{font-weight:700; text-align:right; font-variant-numeric:tabular-nums;}

  .pfn-root footer{padding:24px 0 max(24px, env(safe-area-inset-bottom,0px)); text-align:center; color:var(--muted); font-size:11.5px;}
  .pfn-back-top{
    position:fixed; right:max(16px, env(safe-area-inset-right,0px)); bottom:max(16px, env(safe-area-inset-bottom,0px));
    width:42px; height:42px; border-radius:50%; background:var(--accent); color:var(--accent-fg);
    border:none; font-size:16px; cursor:pointer; box-shadow:var(--shadow); z-index:20;
  }

`;

const PFN_MARKUP = `
<div class="pfn-root">
<div class="pfn-topbar">
  <div class="pfn-wrap">
    <div class="pfn-topbar-row">
      <div class="pfn-brand">
        <div class="pfn-brand-mark">PF</div>
        <div class="pfn-brand-text">
          <h1>PureFibre Call Navigator</h1>
          <p>TELUS winback script &middot; live call reference</p>
        </div>
      </div>
    </div>
    <div class="pfn-search-row">
      <input id="searchBox" type="text" inputmode="search" placeholder="Search a line, objection, or keyword (e.g. &quot;drilling&quot;, &quot;ID&quot;, &quot;contract&quot;)&hellip;" oninput="pfnFilterSOP(this.value)">
      <button class="pfn-search-clear" id="clearBtn" onclick="pfnClearSearch()">&times;</button>
    </div>
  </div>
</div>

<div class="pfn-wrap">

  <nav class="pfn-nav-grid" aria-label="Quick jump">
    <a href="#facts" onclick="return pfnJumpTo('facts')">Quick Facts</a>
    <a href="#step1" onclick="return pfnJumpTo('step1')">1. Opening</a>
    <a href="#step2" onclick="return pfnJumpTo('step2')">2. Reason for Call</a>
    <a href="#step3" onclick="return pfnJumpTo('step3')">3. The Offer</a>
    <a href="#objections" onclick="return pfnJumpTo('objections')">Objections</a>
    <a href="#mnh" onclick="return pfnJumpTo('mnh')">"Not Interested" Close</a>
    <a href="#step4" onclick="return pfnJumpTo('step4')">4. Book Install</a>
    <a href="#step5" onclick="return pfnJumpTo('step5')">5. Account Setup</a>
    <a href="#step6" onclick="return pfnJumpTo('step6')">6. Confirmation</a>
    <a href="#step7" onclick="return pfnJumpTo('step7')">7. Shaw Cancel</a>
    <a href="#step8" onclick="return pfnJumpTo('step8')">8. Wrap Up</a>
  </nav>

  <section id="facts">
    <div class="pfn-section-head"><h2>Quick Facts — know these cold</h2></div>
    <div class="pfn-facts-grid">
      <div class="pfn-fact"><span class="pfn-k">The offer</span><span class="pfn-v">PureFibre 1.5GB, unlimited data</span></div>
      <div class="pfn-fact"><span class="pfn-k">Quoted price</span><span class="pfn-v">$85/mo (shows as $95 until AutoPay)</span></div>
      <div class="pfn-fact"><span class="pfn-k">Standard discount move</span><span class="pfn-v">$85 → $75 (−$10/mo)</span></div>
      <div class="pfn-fact"><span class="pfn-k">Manager courtesy credit</span><span class="pfn-v">$50 one-time, off first bill</span></div>
      <div class="pfn-fact"><span class="pfn-k">Travel freeze option</span><span class="pfn-v">up to 6 mo/yr, $10/mo frozen</span></div>
      <div class="pfn-fact"><span class="pfn-k">Theme pack swaps</span><span class="pfn-v">1 free swap every 30 days</span></div>
      <div class="pfn-fact"><span class="pfn-k">Shaw buyout math</span><span class="pfn-v">~$15 / remaining month / service</span></div>
      <div class="pfn-fact"><span class="pfn-k">Unreturned modem fee</span><span class="pfn-v">up to $200 (Shaw)</span></div>
      <div class="pfn-fact"><span class="pfn-k">ID needed</span><span class="pfn-v">1 gov't ID (DL / BC ID / AB ID / passport)</span></div>
      <div class="pfn-fact"><span class="pfn-k">PIN rule</span><span class="pfn-v">4 digits, can't start with 0</span></div>
      <div class="pfn-fact"><span class="pfn-k">Install windows</span><span class="pfn-v">8–9, 9–11, 11–1, 1–3, 3–5</span></div>
      <div class="pfn-fact"><span class="pfn-k">Verify-us number</span><span class="pfn-v">604-800-8856 · 3578 Fraser St, Van</span></div>
    </div>
  </section>

  <section id="step1-section">
    <div class="pfn-section-head"><h2>Call Flow</h2></div>

    <details class="pfn-card" id="step1" data-searchable open>
      <summary><span class="pfn-step-num">1</span> Opening &amp; Verification</summary>
      <div class="pfn-card-body">
        <div class="pfn-script-block">
          <p class="pfn-script-text">Hi, good <em>[morning/afternoon]</em> — am I speaking with <em>(Customer Name)</em>?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">Great, thanks for picking up! This is Vicar, calling on behalf of TELUS — hope I'm catching you at an okay time. How's your day going so far?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <p class="pfn-wait-note">If they sound positive, mirror it naturally ("That's good to hear!") before moving on.</p>
        <div class="pfn-script-block">
          <p class="pfn-script-text">I'm calling regarding the address on file at <em>[Customer Address]</em>.</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>

        <details class="pfn-objection" data-searchable>
          <summary>"I'm not with TELUS!"</summary>
          <div class="pfn-obj-body">
            <div class="pfn-script-block">
              <p class="pfn-script-text">That's exactly why we're calling today!</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
          </div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I don't live there — I moved!" <span style="font-weight:400;color:var(--muted);">(shortcut: covers Steps 2 &amp; 3 in one breath)</span></summary>
          <div class="pfn-obj-body">
            <div class="pfn-script-block">
              <p class="pfn-script-text">I see — the reason for my call is we recently completed a major fibre upgrade, and we noticed you weren't with us at your older address. Are you still with Shaw at your new address as well?</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
            <p class="pfn-wait-note">Wait for "Yes."</p>
            <div class="pfn-script-block">
              <p class="pfn-script-text">We're reaching out to customers like you who haven't joined our fibre network yet — right now we're offering PureFibre 1.5GB internet, unlimited data, for just $85 a month. Want me to check if your new address qualifies?</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
          </div>
        </details>
      </div>
    </details>

    <details class="pfn-card" id="step2" data-searchable>
      <summary><span class="pfn-step-num">2</span> Reason for Call</summary>
      <div class="pfn-card-body">
        <div class="pfn-script-block">
          <p class="pfn-script-text">The reason for my call — we recently completed a major fibre upgrade in your area, and your home now has pure fibre connected directly to it! Our system shows you're currently using Shaw's cable service — is that right?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <p class="pfn-wait-note">Wait for their answer before continuing.</p>
        <div class="pfn-script-block">
          <p class="pfn-script-text">We're reaching out to customers who haven't joined the fibre network yet, and we've got a great below-market offer for your address.</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
      </div>
    </details>

    <details class="pfn-card" id="step3" data-searchable>
      <summary><span class="pfn-step-num">3</span> Internet &amp; The Offer</summary>
      <div class="pfn-card-body">
        <div class="pfn-script-block">
          <p class="pfn-script-text">Here's what we can offer you: TELUS PureFibre Internet, 1.5 Gigabit speed, with unlimited data — all for just $85 a month.</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">And here's the best part — we take care of cancelling your Shaw account once TELUS is installed, so you don't have to lift a finger.</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
      </div>
    </details>
  </section>

  <section id="objections">
    <div class="pfn-section-head"><h2>Objection Handling</h2><span class="pfn-count">21 objections</span></div>

    <details class="pfn-card" data-searchable open>
      <summary>🛡️ Trust &amp; Legitimacy</summary>
      <div class="pfn-card-body">

        <details class="pfn-objection" data-searchable>
          <summary>"I had TELUS 8 years ago, it was terrible!"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">It wasn't fibre back then — we've since built out our fibre network and just completed another major upgrade, so what you'd get today is a completely different experience.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I'm happy with Shaw!"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Totally understand — and with a much superior service at a much better price, for $85 a month, you might still find real value in taking a quick look. Mind if I walk you through it?</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"How did you get my number?"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">TELUS just completed a major network upgrade in your area, and you're one of the residents we upgraded for — we got your info through legitimate internal channels.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"Why does your number show as spam?"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Oh, it shows possible spam? That's most likely because we make a high volume of calls to customers, so it sometimes gets flagged. I appreciate you letting me know — our numbers are registered, so it should clear up soon.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"Why doesn't it show TELUS on your caller ID?"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Unlike customer service, which runs under one shared number, each TELUS sales rep has their own direct line — I'm with the fibre department, that's why it shows "fibre." Happy to help you verify us if you'd like.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"Can you verify this is legit?"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Of course — you can Google our store number, 604-800-8856, and it'll pull up our store at 3578 Fraser Street, Vancouver. You're welcome to call them directly and verify me there.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

      </div>
    </details>

    <details class="pfn-card" data-searchable>
      <summary>💳 Contract &amp; Billing</summary>
      <div class="pfn-card-body">

        <details class="pfn-objection" data-searchable>
          <summary>"I have a 2-year contract!"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">No problem at all — how many months do you have left on it? I can actually help you check that on your bill.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I don't know how much I'm paying or my speed."</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">No worries, I can help you check that right now — it's usually on the bill you get by email.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I'm paying around the same as Shaw already."</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">That's probably a promotional rate — worth pulling up your bill by email to check the contract end date, since the price usually jumps once that promo runs out.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I still have [X] months left on my contract!"</summary>
          <div class="pfn-obj-body">
            <div class="pfn-script-block">
              <p class="pfn-script-text">No problem — may I ask how much you're currently paying Shaw?</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
            <p class="pfn-wait-note">Wait for their monthly amount, then run the buyout math:</p>
            <div class="pfn-script-block">
              <p class="pfn-script-text">Shaw's cancellation fee works similarly to ours — about $15 per remaining month, per service. So with Internet and TV together, that's roughly $30 × [X months] = $[total]. But here's the thing: since our price is already cheaper every single month, that fee pays for itself within the first few months — and you keep saving for the next 5 years.</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
          </div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I don't want to be locked into a 2-year contract."</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Totally fair — and here's the flexibility: since this plan is so affordable, if you ever don't need it anymore, you can simply transfer it over to a family member or friend instead of cancelling.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

      </div>
    </details>

    <details class="pfn-card" data-searchable>
      <summary>🔧 Technical &amp; Logistics</summary>
      <div class="pfn-card-body">

        <details class="pfn-objection" data-searchable>
          <summary>"I want to use my own modem."</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">That won't be a problem at all — our modem supports bridge mode, so you're free to keep using your own equipment.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"Is there a data cap, or will you throttle my speed?"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Never — your speed stays exactly the same no matter how much you use.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I don't want any drilling!"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">95% of the time there's no drilling needed at all. Once our tech is on-site, he'll walk you through every available option, and if you're not comfortable with any of them, you can cancel for free, no commitment. I'll add a note asking the install team to avoid drilling wherever possible.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I travel for 3 months a year — don't want to pay for internet I'm not using."</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">You can actually freeze your service for up to 6 months a year, for just $10 a month per frozen month.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I'm not sure which premium/add-on I want yet — can you call back?"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">No need to decide today — you can choose your add-ons after installation, and you're able to swap them once a month, completely free.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"Am I stuck with whatever theme pack I pick?"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Not at all — you can swap one theme pack or premium channel every 30 days.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

        <details class="pfn-objection" data-searchable>
          <summary>"I have a Shaw.ca email."</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">You can simply forward your important emails over to a new address, so you never lose anything.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>

      </div>
    </details>

    <details class="pfn-card" data-searchable>
      <summary>📱 Mobility</summary>
      <div class="pfn-card-body">
        <details class="pfn-objection" data-searchable>
          <summary>"I have free mobility through Shaw."</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Totally understand — when you signed up for Shaw's home service, they likely gave you a free SIM on a talk-and-text plan. Good news: since Shaw merged with Rogers back in 2023, that mobile plan is no longer tied to your home service. So switching your home internet to TELUS won't affect your mobile plan at all — and if anything, your Shaw Mobile number can be ported straight over to Rogers, who'll match your current plan. You get TELUS PureFibre at home and keep your mobile exactly as is.</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>
      </div>
    </details>

    <details class="pfn-card" data-searchable>
      <summary>⏱️ Busy / Callback</summary>
      <div class="pfn-card-body">
        <details class="pfn-objection" data-searchable>
          <summary>"I'm busy right now!"</summary>
          <div class="pfn-obj-body">
            <div class="pfn-script-block">
              <p class="pfn-script-text">No problem — can I call you back in about 2 hours?</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
            <p class="pfn-wait-note">One callback attempt, then return to the regular dial cycle.</p>
          </div>
        </details>
        <details class="pfn-objection" data-searchable>
          <summary>"Can you just call me back later?"</summary>
          <div class="pfn-obj-body"><div class="pfn-script-block">
            <p class="pfn-script-text">Of course — and so you have it in writing, want me to send you an email with the details? What's the best email, and what time works best to reach you?</p>
            <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
          </div></div>
        </details>
      </div>
    </details>
  </section>

  <section id="mnh">
    <div class="pfn-section-head"><h2>"Not Interested" — The MNH Close</h2></div>
    <details class="pfn-card" data-searchable open>
      <summary>💬 Full flow: qualify → price-shock → discount</summary>
      <div class="pfn-card-body">
        <div class="pfn-callout pfn-good"><b>How this works</b>Walk the price shock first, then branch into a "manager-approved" discount — real if they're on TELUS/Koodo mobile already, otherwise offer it as your own call. Same numbers either way.</div>

        <div class="pfn-script-block">
          <p class="pfn-script-text">No worries at all — quick question though, have you ever had TELUS before, or have you been with Shaw this whole time?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <p class="pfn-wait-note">Example branch: Cx says "$60 for 1GB with Shaw."</p>
        <div class="pfn-script-block">
          <p class="pfn-script-text">$60 for 1GB is honestly a solid price already — how many months do you have left with Shaw?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <p class="pfn-wait-note">Example: "3 months left."</p>
        <div class="pfn-script-block">
          <p class="pfn-script-text">Got it — just so you know, once that contract ends, Shaw's price for the same plan usually jumps to around $135 a month. Were you aware of that?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>

        <div class="pfn-script-block">
          <p class="pfn-script-text">Just curious — are you on TELUS or Koodo mobility as well?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>

        <details class="pfn-objection" data-searchable open style="margin-top:14px;">
          <summary>If YES → Real MNH (get name, TELUS number, email, address first)</summary>
          <div class="pfn-obj-body">
            <div class="pfn-script-block">
              <p class="pfn-script-text">That's great — are you aware you can get a $10 discount off what you're paying right now? Instead of $85 a month, you'd only pay $75. How does that sound?</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
            <p class="pfn-wait-note">If still hesitant — put them on a brief hold:</p>
            <div class="pfn-script-block">
              <p class="pfn-script-text">One moment, let me check with my manager on the best offer we can do for you.</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
            <div class="pfn-script-block">
              <p class="pfn-script-text">Thank you so much for patiently waiting — my manager told me we can give you a one-time courtesy credit of $50, automatically deducted from your first month's bill. How does that sound?</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
          </div>
        </details>

        <details class="pfn-objection" data-searchable style="margin-top:8px;">
          <summary>If NO → Same move, framed as your own call</summary>
          <div class="pfn-obj-body">
            <div class="pfn-script-block">
              <p class="pfn-script-text">You know what — since you've stuck with me this far, let me go ahead and give you a $10 discount myself. Instead of $85 a month, you'd only pay $75, if you lock this in today.</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
            <p class="pfn-wait-note">If still hesitant — same hold line, then the same $50 credit line above.</p>
          </div>
        </details>
      </div>
    </details>
  </section>

  <section id="step4-section">
    <div class="pfn-section-head"><h2>Closing the Order</h2></div>

    <details class="pfn-card" id="step4" data-searchable>
      <summary><span class="pfn-step-num">4</span> Installation Setup (Assume the Close)</summary>
      <div class="pfn-card-body">
        <div class="pfn-script-block">
          <p class="pfn-script-text">For the install, would you prefer a weekday or a weekend?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">How about the <em>[24th]</em>? That's a <em>[Saturday]</em> — would that work for you?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">For the install time, we have these windows: 8–9, 9–11, 11–1, 1–3, or 3–5. Which works best for you?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
      </div>
    </details>

    <details class="pfn-card" id="step5" data-searchable>
      <summary><span class="pfn-step-num">5</span> Account Setup</summary>
      <div class="pfn-card-body">
        <div class="pfn-script-block">
          <p class="pfn-script-text">We'll need to set up a 4-digit PIN for your TELUS account — any 4 digits, just can't start with 0.</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-callout pfn-warn"><b>Say this every time</b>Please remember this PIN — once I submit the order, I won't be able to see it anymore.</div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">Is this the best number for our technician to reach you about the install?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">What email should we use to set up your TELUS account? <em>(spell it back to confirm)</em></p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">Can you confirm your date of birth for me?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">And I'll need one government-issued ID — a driver's license, BC ID, Alberta ID, or passport.</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>

        <details class="pfn-objection" data-searchable>
          <summary>"Why do you need my ID?"</summary>
          <div class="pfn-obj-body">
            <div class="pfn-script-block">
              <p class="pfn-script-text">Two reasons — first, TELUS runs a soft credit check just to confirm you don't have any older TELUS accounts with outstanding balances. Second, it's to confirm it's really you placing this order, and not someone else using your information.</p>
              <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
            </div>
            <p class="pfn-wait-note">Still not convinced? Offer the same store-verification line from the Trust section above (604-800-8856, 3578 Fraser St, Vancouver).</p>
          </div>
        </details>

        <div class="pfn-script-block">
          <p class="pfn-script-text">Let's also confirm the legal name exactly as it appears on your ID. <em>(spell first and last name; ask if there's a middle name)</em></p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
      </div>
    </details>

    <details class="pfn-card" id="step6" data-searchable>
      <summary><span class="pfn-step-num">6</span> Confirmation</summary>
      <div class="pfn-card-body">
        <div class="pfn-script-block">
          <p class="pfn-script-text">Within 24–48 hours, once our back-end team processes everything and confirms your TELUS credit is clear, you'll get a confirmation email with your account setup steps, plus a text confirming your installation appointment.</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-callout pfn-warn">
          <b>Compliance line — say this exactly, every time</b>
          One important thing — the confirmation email will show a price that's $10 higher than what I quoted you. That's because the $10 discount only kicks in once your service is installed and you've set up AutoPay. So even though it'll show $95 a month, you'll only actually pay $85 once AutoPay is active.
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">Any questions so far?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
      </div>
    </details>

    <details class="pfn-card" id="step7" data-searchable>
      <summary><span class="pfn-step-num">7</span> Shaw Cancellation</summary>
      <div class="pfn-card-body">
        <div class="pfn-script-block">
          <p class="pfn-script-text">One more thing about Shaw — we'll cancel your Shaw account 3 days after TELUS is installed. You'll get a prepaid Canada Post label to drop off your modem.</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-callout pfn-warn">
          <b>Make sure they hear this</b>
          If you don't receive that label within 5 days of installation, please call Shaw directly — they sometimes miss sending it, and if the modem isn't returned, Shaw can charge you up to $200 for it.
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">And just to double-check, can you confirm your address for me again?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
      </div>
    </details>

    <details class="pfn-card" id="step8" data-searchable>
      <summary><span class="pfn-step-num">8</span> Wrap Up</summary>
      <div class="pfn-card-body">
        <div class="pfn-script-block">
          <p class="pfn-script-text">Any other questions for me?</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
        <div class="pfn-script-block">
          <p class="pfn-script-text">Thank you so much — it was really great speaking with you today. Have an amazing rest of your day!</p>
          <button class="pfn-copy-btn" onclick="pfnCopyNearby(this)">Copy</button>
        </div>
      </div>
    </details>
  </section>

  <p class="pfn-no-results" id="noResults">No matches — try a different keyword.</p>

  <footer>PureFibre Call Navigator &middot; internal use only &middot; built for live calls</footer>
</div>

<button class="pfn-back-top" onclick="window.scrollTo({top:0,behavior:'smooth'})" aria-label="Back to top">↑</button>
</div>

`;

export default function TelusNavigator() {
  useEffect(() => {
    // The app's own Navbar renders right above this component and is itself
    // sticky at the very top of the viewport. Without this, the navigator's
    // own sticky search header would also try to stick at top:0 and end up
    // hidden behind the app Navbar once the page scrolls. Measure the
    // Navbar's real height (it can change - e.g. its links wrap onto a
    // second line on a narrow phone) and feed it to the CSS below as a
    // custom property so the navigator's header sticks just under it.
    const header = document.querySelector("header");
    const updateNavbarOffset = () => {
      const h = header ? header.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty("--pfn-navbar-offset", `${h}px`);
    };
    updateNavbarOffset();
    let observer: ResizeObserver | undefined;
    if (header && typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(updateNavbarOffset);
      observer.observe(header);
    }
    window.addEventListener("resize", updateNavbarOffset);

    // Raw <script> tags inside dangerouslySetInnerHTML never execute, so the
    // navigator's behavior (copy-to-clipboard, quick-jump, live search) is
    // defined here instead and attached to window, exactly like the
    // original standalone page's inline onclick="..."/oninput="..."
    // attributes expect.
    function pfnCopyNearby(btn: any) {
      var block = btn.closest(".pfn-script-block");
      var textEl = block ? block.querySelector(".pfn-script-text") : null;
      var text = textEl ? textEl.innerText : "";
      var done = function () {
        var original = btn.textContent;
        btn.textContent = "Copied!";
        btn.classList.add("pfn-copied");
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("pfn-copied");
        }, 1400);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard
          .writeText(text)
          .then(done)
          .catch(function () {
            pfnFallbackCopy(text, done);
          });
      } else {
        pfnFallbackCopy(text, done);
      }
    }
    function pfnFallbackCopy(text: any, done: any) {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        done();
      } catch (e) {}
    }

    function pfnJumpTo(id: any) {
      var el: any = document.getElementById(id);
      if (!el) return false;
      var det: any = el.tagName === "DETAILS" ? el : el.closest("details");
      if (det) det.open = true;
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      return false;
    }

    function pfnFilterSOP(q: any) {
      q = q.trim().toLowerCase();
      var clearBtn: any = document.getElementById("clearBtn");
      if (clearBtn) clearBtn.classList.toggle("pfn-show", q.length > 0);
      var items = document.querySelectorAll("[data-searchable]");
      var anyMatch = false;
      items.forEach(function (el: any) {
        var match = !q || el.textContent.toLowerCase().indexOf(q) !== -1;
        el.hidden = !match;
        if (match && q) {
          anyMatch = true;
          el.open = true;
          var p: any = el.parentElement ? el.parentElement.closest("details") : null;
          while (p) {
            p.open = true;
            p.hidden = false;
            p = p.parentElement ? p.parentElement.closest("details") : null;
          }
        }
      });
      var noResults: any = document.getElementById("noResults");
      if (noResults) noResults.classList.toggle("pfn-show", !!q && !anyMatch);
    }

    function pfnClearSearch() {
      var box: any = document.getElementById("searchBox");
      if (!box) return;
      box.value = "";
      pfnFilterSOP("");
      box.focus();
    }

    (window as any).pfnCopyNearby = pfnCopyNearby;
    (window as any).pfnJumpTo = pfnJumpTo;
    (window as any).pfnFilterSOP = pfnFilterSOP;
    (window as any).pfnClearSearch = pfnClearSearch;
    (window as any).pfnFallbackCopy = pfnFallbackCopy;

    return () => {
      window.removeEventListener("resize", updateNavbarOffset);
      observer?.disconnect();
      document.documentElement.style.removeProperty("--pfn-navbar-offset");
      delete (window as any).pfnCopyNearby;
      delete (window as any).pfnJumpTo;
      delete (window as any).pfnFilterSOP;
      delete (window as any).pfnClearSearch;
      delete (window as any).pfnFallbackCopy;
    };
  }, []);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PFN_CSS }} />
      <div dangerouslySetInnerHTML={{ __html: PFN_MARKUP }} />
    </>
  );
}

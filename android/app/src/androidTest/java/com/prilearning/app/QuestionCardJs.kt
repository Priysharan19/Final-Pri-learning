// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what an instrumented journey may ask a question card
//
// Page expressions shared by ShellJourneyTest and CloudJourneyTest. They read
// only what a student can see on the card (and the card's own data-*
// attributes); none of them reads an answer, a mark scheme or a solution from
// the page. Grading is online-only and server-authoritative (owner decision
// 2026-10-10, ADR-0001), so the same selectors must show NOTHING marked while
// a check is refused. A question that can never be marked (opened with no
// connection: an offline draft) says so BEFORE any work and offers neither
// Submit nor Show solution; its one action is to try for a markable question,
// which never costs the work on the card by itself. Kept in step with the iOS
// journey's card helpers (ios/PriLearning.swiftpm/JourneySelfCheck.swift).
// ─────────────────────────────────────────────────────────────────────────────
package com.prilearning.app

object QuestionCardJs {
    private const val VIS = "function(s){return [].slice.call(document.querySelectorAll(s)).filter(function(e){return e.getClientRects().length>0;});}"

    /** The local id of the question on the card ('' when there is none). */
    const val QID = "(function(){var el=document.querySelector('.qpage[data-question-id]');return el?el.getAttribute('data-question-id'):'';})()"

    /** The typed final answer as the card holds it right now (null: no typed input). */
    const val TYPED = "(function(){var el=document.querySelector('.editor-body input.answer-input');return el?el.value:null;})()"

    /** Why the last check was refused, as the card states it, or false. */
    const val REFUSAL = "(function(){var e=($VIS)('[data-check-refusal]')[0];return e?e.getAttribute('data-check-refusal'):false;})()"

    /** Is this control on screen? */
    fun visible(selector: String) = "(($VIS)('$selector').length>0)"

    /**
     * Everything a marker, and only a marker, puts on a question card, as a
     * comma-separated list ('' when the card is unmarked).
     */
    const val MARKED_TRACES = """(function(){var vis=$VIS;var out=[];
        [['evaluation','.eval-card'],['marks','.eval-marks'],['verdict','.verdict-bad'],
         ['solution','.solution-panel, .solution-block, .eval-expected'],['yourAnswer','.your-answer'],
         ['redo','.redo-chip'],['misconception','.diagnosis-named, .diagnosis-card']].forEach(function(m){if(vis(m[1]).length)out.push(m[0]);});
        var page=document.querySelector('.qpage');
        if(/\bXP\b/.test(vis('.qpage').map(function(e){return e.innerText;}).join(' ')))out.push('xp');
        if(page&&page.getAttribute('data-phase')==='resolved')out.push('resolved');
        return out.join(',');})()"""

    /** The typed draft of question `id` as this device stored it ('' until stored). */
    fun storedTyped(id: String) = """(function(){var k=Object.keys(localStorage).find(function(x){return x.endsWith('.question.$id');});
        if(!k)return '';var d=(JSON.parse(localStorage.getItem(k))||{}).data;return d&&typeof d.typed==='string'?d.typed:'';})()"""

    private const val PRIMARY = "document.querySelector('.ws-actions .ws-actions-btns .btn-primary')"
    // Submit is the primary control only while the question can be marked: on
    // an unmarkable question the primary is the replace action, never Submit.
    private const val SUBMIT = "document.querySelector('.ws-actions .ws-actions-btns .btn-primary:not([data-primary-action])')"
    private const val REPLACE = "(($VIS)('.ws-actions .ws-actions-btns .btn-primary[data-primary-action=\"replace\"]')[0]||null)"
    private const val BUSY = "(function(){var p=$PRIMARY;var s=document.querySelector('.ws-actions .status-line');return !!((p&&p.getAttribute('aria-busy')==='true')||(s&&s.getAttribute('data-state')==='working'));})()"

    /**
     * Press the card's Submit and start watching for the check it starts, so a
     * check that finishes between two polls is not missed. False until the
     * control is enabled — and false for as long as the card offers no Submit
     * (an unmarkable question's primary control is never pressed by this).
     */
    const val PRESS_SUBMIT = """(function(){var p=$SUBMIT;if(!p||p.disabled)return false;
        if(window.__priWatch)window.__priWatch.disconnect();window.__priRan=false;
        var busy=function(){return $BUSY;};
        window.__priWatch=new MutationObserver(function(){if(busy())window.__priRan=true;});
        window.__priWatch.observe(document.body,{subtree:true,attributes:true,childList:true,characterData:true});
        p.click();return true;})()"""

    /** True once the check PRESS_SUBMIT started has been seen running. */
    const val CHECK_STARTED = "(window.__priRan===true||$BUSY)"

    /** True once no check is running. */
    const val CHECK_IDLE = "(!$BUSY)"

    /** What the card shows after a check: the check's answer, in the card's own terms. */
    const val OUTCOME = """(function(){if(window.__priWatch){window.__priWatch.disconnect();window.__priWatch=null;}
        var q=function(s){return document.querySelector(s);};
        return (q('.eval-card')&&'evaluated')||(($REFUSAL)&&'refused')||(q('.verdict-technical')&&'technical')||
          (q('.verdict-unsure')&&'unreadable')||(q('.verdict-bad')&&'miss')||(q('.ws-check')&&'confirm')||'nothing';})()"""

    /** "n / n marks" when the evaluation shows full marks out of a positive total, else ''. */
    const val FULL_MARKS = """(function(){var t=($VIS)('.eval-marks').map(function(e){return e.innerText;}).join(' ').replace(/\s+/g,' ').trim();
        var m=t.match(/^(\d+(?:\.\d+)?) \/ (\d+(?:\.\d+)?) marks?/);return m&&m[1]===m[2]&&Number(m[2])>0?m[0]:'';})()"""

    /** The Show solution control (armed by one press, confirmed by the next); false when absent. */
    const val PRESS_REVEAL = """(function(){var b=($VIS)('.ws-actions .ws-actions-btns button').find(function(x){return /^Show solution/.test(x.textContent.trim());});
        if(!b)return false;b.click();return true;})()"""

    // ── A question that cannot be marked (an offline draft) ──────────────────
    /** Why the card says this question cannot be marked ('draft', 'legacy', 'teacher'), or false. */
    const val UNMARKABLE = "(function(){var e=($VIS)('[data-check-unmarkable]')[0];return e?e.getAttribute('data-check-unmarkable'):false;})()"

    /** The notice as a student reads it ('' when there is none). */
    const val UNMARKABLE_SAYS = "(($VIS)('[data-check-unmarkable]').map(function(e){return e.innerText;}).join(' ').replace(/\\s+/g,' ').trim())"

    /**
     * What the card offers to do, as "<primary>|<n primaries>|<solution>":
     * the one primary control ('replace', or 'submit' for an ordinary
     * question, 'none' when there is none), how many primary controls are on
     * screen, and whether any control on the card offers a solution.
     */
    const val OFFERS = """(function(){var vis=$VIS;var p=vis('.ws-actions .btn-primary');
        var kind=p.length?(p[0].getAttribute('data-primary-action')||'submit'):'none';
        var sol=vis('.ws-actions button').filter(function(b){return /solution/i.test(b.textContent);}).length>0;
        return kind+'|'+p.length+'|'+(sol?'solution':'no-solution');})()"""

    /** The primary control's label as shown ('' when there is none). */
    const val PRIMARY_LABEL = "(function(){var p=($VIS)('.ws-actions .ws-actions-btns .btn-primary')[0];return p?p.textContent.replace(/\\s+/g,' ').trim():'';})()"

    /** Press "Try for a markable question" (or its confirmation). False until it is on screen and enabled. */
    const val PRESS_REPLACE = "(function(){var p=$REPLACE;if(!p||p.disabled)return false;p.click();return true;})()"

    /** Press "Keep working on this one". False until it is on screen. */
    const val PRESS_REPLACE_CANCEL = "(function(){var b=($VIS)('.ws-actions [data-check-replace-cancel]')[0];if(!b||b.disabled)return false;b.click();return true;})()"

    /**
     * True once a confirmed replace has finished without replacing anything:
     * the card is idle again, no longer asks to confirm, and says that a
     * markable question could not be opened.
     */
    const val REPLACE_DECLINED = "((!$BUSY)&&($VIS)('[data-check-replace-confirm]').length===0&&($VIS)('[data-check-replace-note]').length>0)"

    /** The "could not be opened" note as a student reads it ('' when absent). */
    const val REPLACE_NOTE_SAYS = "(($VIS)('[data-check-replace-note]').map(function(e){return e.innerText;}).join(' ').replace(/\\s+/g,' ').trim())"
}

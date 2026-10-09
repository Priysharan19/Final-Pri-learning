// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · what an instrumented journey may ask a question card
//
// Page expressions shared by ShellJourneyTest and CloudJourneyTest. They read
// only what a student can see on the card (and the card's own data-*
// attributes); none of them reads an answer, a mark scheme or a solution from
// the page. Grading is online-only and server-authoritative (owner decision
// 2026-10-10, ADR-0001), so the same selectors must show NOTHING marked while
// a check is refused. Kept in step with the iOS journey's card helpers
// (ios/PriLearning.swiftpm/JourneySelfCheck.swift).
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
    private const val BUSY = "(function(){var p=$PRIMARY;var s=document.querySelector('.ws-actions .status-line');return !!((p&&p.getAttribute('aria-busy')==='true')||(s&&s.getAttribute('data-state')==='working'));})()"

    /**
     * Press the card's primary control (Submit) and start watching for the
     * check it starts, so a check that finishes between two polls is not missed.
     * False until the control is enabled.
     */
    const val PRESS_SUBMIT = """(function(){var p=$PRIMARY;if(!p||p.disabled)return false;
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
}

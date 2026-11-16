/**
 * @name Missing rate limiting
 * @description An HTTP request handler that performs expensive operations without
 *              restricting the rate at which operations can be carried out is vulnerable
 *              to denial-of-service attacks.
 * @kind problem
 * @problem.severity warning
 * @security-severity 7.5
 * @precision high
 * @id js/missing-rate-limiting
 * @tags security
 *       external/cwe/cwe-770
 *       external/cwe/cwe-307
 *       external/cwe/cwe-400
 *       pri/rate-limit-model
 */

// The standard js/missing-rate-limiting query (github/codeql
// javascript/ql/src/Security/CWE-770/MissingRateLimiting.ql), unchanged except
// for one extra RateLimitingMiddleware: Pri Learning's own DB-backed limiter,
// rateLimit(db, key, options) in server/platform/security.js. Without it every
// route guarded by that limiter is reported as unguarded (issue #569).
// codeql-config.yml excludes the stock copy and includes this one by its tag,
// so the alert id — and the history of every existing alert — is unchanged.
// What keeps each production route limited is server/test/route-inventory-check.mjs;
// this model only stops the scanner reporting routes that are guarded.

import javascript
import semmle.javascript.security.dataflow.MissingRateLimiting
import semmle.javascript.RestrictedLocations

/** A call to the platform limiter `rateLimit()` exported by server/platform/security.js. */
class PriPlatformRateLimit extends RateLimitingMiddleware instanceof DataFlow::CallNode {
  PriPlatformRateLimit() {
    exists(Function limiter |
      limiter = super.getACallee() and
      limiter.getName() = "rateLimit" and
      limiter.getFile().getRelativePath() = "server/platform/security.js"
    )
  }
}

from
  Routing::Node useSite, ExpensiveRouteHandler r, string explanation, DataFlow::Node reference,
  string referenceLabel
where
  useSite = Routing::getNode(r).getRouteInstallation() and
  r.explain(explanation, reference, referenceLabel) and
  not useSite.isGuardedByNode(any(RateLimitingMiddleware m).getRoutingNode())
select useSite, "This route handler " + explanation + ", but is not rate-limited.", reference,
  referenceLabel

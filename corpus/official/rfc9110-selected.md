# RFC 9110 — selected unmodified sections

Source: https://www.rfc-editor.org/rfc/rfc9110.txt
Version: June 2022. Copyright and IETF Trust notice are preserved in corpus/raw/rfc9110.txt. See https://trustee.ietf.org/license-info.

9.2.1.  Safe Methods

   Request methods are considered "safe" if their defined semantics are
   essentially read-only; i.e., the client does not request, and does
   not expect, any state change on the origin server as a result of
   applying a safe method to a target resource.  Likewise, reasonable
   use of a safe method is not expected to cause any harm, loss of
   property, or unusual burden on the origin server.

   This definition of safe methods does not prevent an implementation
   from including behavior that is potentially harmful, that is not
   entirely read-only, or that causes side effects while invoking a safe
   method.  What is important, however, is that the client did not
   request that additional behavior and cannot be held accountable for
   it.  For example, most servers append request information to access
   log files at the completion of every response, regardless of the
   method, and that is considered safe even though the log storage might
   become full and cause the server to fail.  Likewise, a safe request
   initiated by selecting an advertisement on the Web will often have
   the side effect of charging an advertising account.

   Of the request methods defined by this specification, the GET, HEAD,
   OPTIONS, and TRACE methods are defined to be safe.

   The purpose of distinguishing between safe and unsafe methods is to
   allow automated retrieval processes (spiders) and cache performance
   optimization (pre-fetching) to work without fear of causing harm.  In
   addition, it allows a user agent to apply appropriate constraints on
   the automated use of unsafe methods when processing potentially
   untrusted content.

   A user agent SHOULD distinguish between safe and unsafe methods when
   presenting potential actions to a user, such that the user can be
   made aware of an unsafe action before it is requested.

   When a resource is constructed such that parameters within the target
   URI have the effect of selecting an action, it is the resource
   owner's responsibility to ensure that the action is consistent with
   the request method semantics.  For example, it is common for Web-
   based content editing software to use actions within query
   parameters, such as "page?do=delete".  If the purpose of such a
   resource is to perform an unsafe action, then the resource owner MUST
   disable or disallow that action when it is accessed using a safe
   request method.  Failure to do so will result in unfortunate side
   effects when automated processes perform a GET on every URI reference
   for the sake of link maintenance, pre-fetching, building a search
   index, etc.

9.2.2.  Idempotent Methods

   A request method is considered "idempotent" if the intended effect on
   the server of multiple identical requests with that method is the
   same as the effect for a single such request.  Of the request methods
   defined by this specification, PUT, DELETE, and safe request methods
   are idempotent.

   Like the definition of safe, the idempotent property only applies to
   what has been requested by the user; a server is free to log each
   request separately, retain a revision control history, or implement
   other non-idempotent side effects for each idempotent request.

   Idempotent methods are distinguished because the request can be
   repeated automatically if a communication failure occurs before the
   client is able to read the server's response.  For example, if a
   client sends a PUT request and the underlying connection is closed
   before any response is received, then the client can establish a new
   connection and retry the idempotent request.  It knows that repeating
   the request will have the same intended effect, even if the original
   request succeeded, though the response might differ.

   A client SHOULD NOT automatically retry a request with a non-
   idempotent method unless it has some means to know that the request
   semantics are actually idempotent, regardless of the method, or some
   means to detect that the original request was never applied.

   For example, a user agent can repeat a POST request automatically if
   it knows (through design or configuration) that the request is safe
   for that resource.  Likewise, a user agent designed specifically to
   operate on a version control repository might be able to recover from
   partial failure conditions by checking the target resource
   revision(s) after a failed connection, reverting or fixing any
   changes that were partially applied, and then automatically retrying
   the requests that failed.

   Some clients take a riskier approach and attempt to guess when an
   automatic retry is possible.  For example, a client might
   automatically retry a POST request if the underlying transport
   connection closed before any part of a response is received,
   particularly if an idle persistent connection was used.

   A proxy MUST NOT automatically retry non-idempotent requests.  A
   client SHOULD NOT automatically retry a failed automatic retry.

15.5.2.  401 Unauthorized

   The 401 (Unauthorized) status code indicates that the request has not
   been applied because it lacks valid authentication credentials for
   the target resource.  The server generating a 401 response MUST send
   a WWW-Authenticate header field (Section 11.6.1) containing at least
   one challenge applicable to the target resource.

   If the request included authentication credentials, then the 401
   response indicates that authorization has been refused for those
   credentials.  The user agent MAY repeat the request with a new or
   replaced Authorization header field (Section 11.6.2).  If the 401
   response contains the same challenge as the prior response, and the
   user agent has already attempted authentication at least once, then
   the user agent SHOULD present the enclosed representation to the
   user, since it usually contains relevant diagnostic information.

15.5.3.  402 Payment Required

   The 402 (Payment Required) status code is reserved for future use.

15.4.5.  304 Not Modified

   The 304 (Not Modified) status code indicates that a conditional GET
   or HEAD request has been received and would have resulted in a 200
   (OK) response if it were not for the fact that the condition
   evaluated to false.  In other words, there is no need for the server
   to transfer a representation of the target resource because the
   request indicates that the client, which made the request
   conditional, already has a valid representation; the server is
   therefore redirecting the client to make use of that stored
   representation as if it were the content of a 200 (OK) response.

   The server generating a 304 response MUST generate any of the
   following header fields that would have been sent in a 200 (OK)
   response to the same request:

   *  Content-Location, Date, ETag, and Vary

   *  Cache-Control and Expires (see [CACHING])

   Since the goal of a 304 response is to minimize information transfer
   when the recipient already has one or more cached representations, a
   sender SHOULD NOT generate representation metadata other than the
   above listed fields unless said metadata exists for the purpose of
   guiding cache updates (e.g., Last-Modified might be useful if the
   response does not have an ETag field).

   Requirements on a cache that receives a 304 response are defined in
   Section 4.3.4 of [CACHING].  If the conditional request originated
   with an outbound client, such as a user agent with its own cache
   sending a conditional GET to a shared proxy, then the proxy SHOULD
   forward the 304 response to that client.

   A 304 response is terminated by the end of the header section; it
   cannot contain content or trailers.
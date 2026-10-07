# Architecture rules

- Authorize paving releases in the database RPC using the authenticated user's real roles; UI perspective is not authorization.
- Keep paving release assignment as historical metadata only; active releases and aggregate production are shared, while individual records are author-scoped.
- Keep paving author and production beneficiary separate when technical staff enter production; do not overwrite the authenticated author with a selector.
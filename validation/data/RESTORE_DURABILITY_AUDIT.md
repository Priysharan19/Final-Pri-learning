# iPad data durability audit — backup restore

Status: **OPEN / code fix required**

## Confirmed finding

`POST /data/import` in `client/src/local/backend.js` currently creates the restored profile first and then writes backup rows store-by-store. Each row write is wrapped in an empty `catch { }`.

That means an IndexedDB failure caused by storage pressure, a transaction error, or another unexpected write failure can be silently ignored. The route can continue, select the new profile and return success even though only part of the backup landed.

For an offline-first iPad app this is a data-integrity defect: "restore succeeded" must never mean "some unknown subset was restored".

## Required behaviour

The restore path must distinguish intentionally rejected malformed rows from unexpected persistence failures.

For unexpected write failures:

1. stop the restore;
2. remove the newly created partial profile and every row already written for its new pid (`wipeProfile(newPid)` is available in the IndexedDB layer and also removes the profile row);
3. leave the previously selected profile unchanged;
4. return an explicit restore failure to the UI;
5. never report the partial restore as success.

Where compatibility policy intentionally drops an unsupported/malformed row, count and report it explicitly rather than silently hiding the loss.

## Regression test required

Inject a deterministic write failure after at least one restored store has already written data and assert all of the following:

- `/data/import` rejects;
- no new restored profile remains;
- no rows belonging to the new pid remain in any profile-owned store;
- the source profile remains untouched;
- the current selected profile is still the source profile;
- a retry with the injected failure removed restores every expected row exactly once.

## Additional restore cases

- truncated JSON is rejected before mutation;
- wrong `format` is rejected before mutation;
- future unsupported backup versions are not silently interpreted as current format;
- duplicate/crafted keys cannot overwrite another profile;
- auto-increment stores receive fresh ids;
- encrypted source backup restores as the documented unprotected restored profile without carrying password/vault material;
- low-storage failure is surfaced to the student with a recoverable retry path.

## Release rule

Until the rollback regression passes, backup/export remains useful but should not be treated as fully proven disaster recovery for the iPad product.

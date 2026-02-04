# Data Corruption & Pipeline Failure Analysis

**Last Updated:** February 3, 2026  
**Status:** 🔍 Analysis Complete, Safeguards In Progress

## Executive Summary

This document identifies 15 critical failure modes that could corrupt data or break the pipeline, ranked by likelihood and impact. Each failure mode includes detection methods, prevention strategies, and recovery procedures.

## Failure Mode Matrix

| # | Failure Mode | Likelihood | Impact | Detection Time | Recovery Time |
|---|--------------|------------|--------|----------------|---------------|
| 1 | Google Drive auth expiry | High | Critical | Immediate | 5 min (manual) |
| 2 | Document format changed | Medium | High | 1 sync cycle | 30 min |
| 3 | Network timeout during sync | High | Medium | Immediate | Auto (retry) |
| 4 | Partial sync (some files fail) | Medium | High | 1 sync cycle | Auto (retry) |
| 5 | Database connection lost | Low | Critical | Immediate | Auto (reconnect) |
| 6 | Malformed Word document | Low | Medium | Immediate | 1 sync cycle |
| 7 | Empty/missing source files | Low | High | Immediate | Manual |
| 8 | Database schema drift | Very Low | Critical | Immediate | Manual (migration) |
| 9 | Disk space exhausted | Very Low | Critical | Immediate | Manual |
| 10 | Parser bug (bad regex) | Low | High | 1 sync cycle | Code fix |
| 11 | Duplicate data insertion | Medium | Medium | Post-sync | Auto (constraints) |
| 12 | Character encoding issues | Low | Low | Visual inspection | Auto (UTF-8) |
| 13 | Sync scheduler failure | Low | High | 24 hours | Auto (restart) |
| 14 | LLM API rate limit | Medium | Low | Immediate | Auto (backoff) |
| 15 | Concurrent sync execution | Very Low | High | Immediate | Lock file |

---

## Detailed Failure Modes

### 1. Google Drive Authentication Expiry

**Description:** rclone OAuth token expires, preventing access to source documents.

**Likelihood:** High (tokens expire, user revokes access, account issues)

**Impact:** Critical (complete pipeline failure, no data updates)

**Symptoms:**
```
rclone error: Failed to authenticate
Error 401: Unauthorized
```

**Detection:**
- Sync script exits with error code
- Log contains "authentication" or "401"
- No files downloaded from Google Drive

**Prevention:**
- ✅ Already implemented: rclone config with long-lived tokens
- 🔄 Add: Pre-sync authentication test
- 🔄 Add: Token refresh automation
- 🔄 Add: Alert when token expiry approaching

**Recovery:**
1. Manual: Re-authenticate rclone (`rclone config reconnect`)
2. Automatic: Implement token refresh in sync script
3. Fallback: Use cached data from last successful sync

**Implementation Priority:** HIGH

---

### 2. Document Format Changed

**Description:** Source document structure changes (new sections, renamed headings, different formatting).

**Likelihood:** Medium (documents evolve, templates change)

**Impact:** High (parser fails, data missing or misinterpreted)

**Symptoms:**
```
Parser warning: Expected section "HIGHLIGHTS" not found
Parser warning: No items extracted from document
Empty database tables after sync
```

**Detection:**
- Parser returns 0 items when expecting data
- Log contains "not found" or "unexpected format"
- Post-sync validation fails (item count = 0)

**Prevention:**
- ✅ Already implemented: Flexible regex patterns
- 🔄 Add: Schema version detection in documents
- 🔄 Add: Parser fallback modes (try multiple patterns)
- 🔄 Add: Alert when item count drops significantly

**Recovery:**
1. Automatic: Parser tries alternative patterns
2. Manual: Update parser regex in `parse_*.py`
3. Fallback: Keep last known good data visible with "stale data" warning

**Implementation Priority:** HIGH

---

### 3. Network Timeout During Sync

**Description:** Network interruption while downloading files or uploading to database.

**Likelihood:** High (network instability, large files, slow connections)

**Impact:** Medium (partial sync, retry succeeds)

**Symptoms:**
```
rclone error: connection timeout
curl: (28) Operation timed out
```

**Detection:**
- Sync script exits with error code
- Log contains "timeout" or "connection"
- File download incomplete

**Prevention:**
- ✅ Already implemented: Timeout settings in rclone
- 🔄 Add: Retry logic with exponential backoff
- 🔄 Add: Resume capability for partial downloads
- 🔄 Add: Network health check before sync

**Recovery:**
1. Automatic: Retry failed operation (3 attempts)
2. Automatic: Exponential backoff (1s, 2s, 4s)
3. Manual: Trigger sync manually after network restored

**Implementation Priority:** MEDIUM

---

### 4. Partial Sync (Some Files Fail)

**Description:** Some source files sync successfully, others fail (permissions, corruption, missing).

**Likelihood:** Medium (file-specific issues)

**Impact:** High (incomplete data, inconsistent dashboard)

**Symptoms:**
```
Sync completed with warnings
3/6 files synced successfully
Parser error: File not found
```

**Detection:**
- Sync script reports partial success
- Some tables updated, others unchanged
- Log shows file-specific errors

**Prevention:**
- ✅ Already implemented: Individual file error handling
- 🔄 Add: Track which files synced successfully
- 🔄 Add: Retry only failed files
- 🔄 Add: Alert on partial sync

**Recovery:**
1. Automatic: Retry failed files only
2. Automatic: Mark stale sections with warning badge
3. Manual: Investigate file-specific issues

**Implementation Priority:** HIGH

---

### 5. Database Connection Lost

**Description:** MySQL connection drops during sync (server restart, network issue, timeout).

**Likelihood:** Low (database is stable)

**Impact:** Critical (data not saved, sync appears successful but isn't)

**Symptoms:**
```
mysql.connector.errors.OperationalError: Lost connection
Error 2006: MySQL server has gone away
```

**Detection:**
- Python script raises database exception
- Sync script exits with error
- Database unchanged after sync

**Prevention:**
- ✅ Already implemented: Connection pooling
- 🔄 Add: Connection health check before writes
- 🔄 Add: Automatic reconnection logic
- 🔄 Add: Transaction rollback on failure

**Recovery:**
1. Automatic: Reconnect and retry operation
2. Automatic: Rollback partial transaction
3. Manual: Restart database if needed

**Implementation Priority:** MEDIUM

---

### 6. Malformed Word Document

**Description:** Source document is corrupted or has invalid XML structure.

**Likelihood:** Low (rare, but happens)

**Impact:** Medium (one document fails, others succeed)

**Symptoms:**
```
zipfile.BadZipFile: File is not a zip file
xml.etree.ElementTree.ParseError: not well-formed
```

**Detection:**
- Parser raises exception
- Log contains "BadZipFile" or "ParseError"
- Specific document fails to parse

**Prevention:**
- ✅ Already implemented: Try-except in parsers
- 🔄 Add: File integrity check before parsing
- 🔄 Add: Fallback to previous version of document
- 🔄 Add: Alert document owner of corruption

**Recovery:**
1. Automatic: Skip corrupted document, use cached data
2. Manual: Re-download document from Google Drive
3. Manual: Ask document owner to fix and re-save

**Implementation Priority:** LOW

---

### 7. Empty or Missing Source Files

**Description:** Source document deleted, moved, or renamed in Google Drive.

**Likelihood:** Low (documents are stable)

**Impact:** High (missing data section, incomplete dashboard)

**Symptoms:**
```
rclone error: File not found
Parser error: No such file or directory
Empty table after sync
```

**Detection:**
- rclone reports file not found
- Parser cannot open file
- Post-sync validation shows missing data

**Prevention:**
- ✅ Already implemented: File path configuration
- 🔄 Add: Pre-sync file existence check
- 🔄 Add: Alert when file missing
- 🔄 Add: Keep last known good data

**Recovery:**
1. Automatic: Use cached data from last sync
2. Manual: Locate moved/renamed file
3. Manual: Update file path in configuration

**Implementation Priority:** MEDIUM

---

### 8. Database Schema Drift

**Description:** Code expects different schema than database has (missing columns, wrong types).

**Likelihood:** Very Low (schema is stable)

**Impact:** Critical (all writes fail, dashboard breaks)

**Symptoms:**
```
mysql.connector.errors.ProgrammingError: Unknown column
TypeError: unsupported operand type(s)
```

**Detection:**
- Database queries fail
- Sync script crashes
- Dashboard shows errors

**Prevention:**
- ✅ Already implemented: Drizzle schema management
- 🔄 Add: Schema version check at startup
- 🔄 Add: Migration validation
- 🔄 Add: Schema backup before migrations

**Recovery:**
1. Manual: Run missing migrations
2. Manual: Rollback to previous checkpoint
3. Manual: Fix schema mismatch

**Implementation Priority:** LOW (rare, but critical)

---

### 9. Disk Space Exhausted

**Description:** Server runs out of disk space for temp files, logs, or database.

**Likelihood:** Very Low (plenty of space)

**Impact:** Critical (writes fail, sync stops)

**Symptoms:**
```
OSError: [Errno 28] No space left on device
mysql.connector.errors.DatabaseError: Disk full
```

**Detection:**
- Write operations fail
- Log contains "No space" or "Disk full"
- `df -h` shows 100% usage

**Prevention:**
- 🔄 Add: Disk space check before sync
- 🔄 Add: Log rotation (keep last 7 days)
- 🔄 Add: Temp file cleanup
- 🔄 Add: Alert at 80% disk usage

**Recovery:**
1. Automatic: Clean up old logs and temp files
2. Manual: Expand disk or delete old data
3. Manual: Restart sync after space freed

**Implementation Priority:** LOW

---

### 10. Parser Bug (Bad Regex)

**Description:** Parser regex has bug causing incorrect extraction or crashes.

**Likelihood:** Low (parsers are tested)

**Impact:** High (data corruption, wrong information displayed)

**Symptoms:**
```
Parser extracts wrong sections
Bold text not detected
Hyperlinks missing
Data in wrong table columns
```

**Detection:**
- Visual inspection of dashboard
- Post-sync validation (data quality checks)
- User reports incorrect data

**Prevention:**
- ✅ Already implemented: Tested parsers
- 🔄 Add: Parser unit tests
- 🔄 Add: Data quality validation
- 🔄 Add: Compare with previous sync for anomalies

**Recovery:**
1. Manual: Fix parser bug in code
2. Manual: Re-run sync with fixed parser
3. Automatic: Rollback to previous data

**Implementation Priority:** MEDIUM

---

### 11. Duplicate Data Insertion

**Description:** Sync runs twice or doesn't clear old data, causing duplicates.

**Likelihood:** Medium (race condition, manual trigger during auto-sync)

**Impact:** Medium (duplicate items, confusing dashboard)

**Symptoms:**
```
Dashboard shows same item multiple times
Database has duplicate rows
Item count doubles after sync
```

**Detection:**
- Post-sync validation (check for duplicates)
- User reports seeing duplicates
- Database query shows duplicate content

**Prevention:**
- ✅ Already implemented: DELETE before INSERT in sync
- 🔄 Add: Sync lock file (prevent concurrent runs)
- 🔄 Add: Unique constraints on content+section
- 🔄 Add: Duplicate detection in post-sync check

**Recovery:**
1. Automatic: UNIQUE constraints prevent duplicates
2. Manual: Run deduplication SQL query
3. Manual: Re-run sync to reset data

**Implementation Priority:** MEDIUM

---

### 12. Character Encoding Issues

**Description:** Non-UTF-8 characters cause corruption or display issues.

**Likelihood:** Low (most content is ASCII/UTF-8)

**Impact:** Low (display issues, rarely data loss)

**Symptoms:**
```
Dashboard shows � or garbled text
Parser warning: UnicodeDecodeError
Database stores mojibake
```

**Detection:**
- Visual inspection of dashboard
- Log contains "UnicodeDecodeError"
- Database query shows weird characters

**Prevention:**
- ✅ Already implemented: UTF-8 encoding in parsers
- 🔄 Add: Encoding validation in parsers
- 🔄 Add: Character sanitization
- 🔄 Add: Database UTF-8 collation

**Recovery:**
1. Automatic: Parser handles encoding errors gracefully
2. Manual: Fix encoding in source document
3. Manual: Re-run sync

**Implementation Priority:** LOW

---

### 13. Sync Scheduler Failure

**Description:** Cron job or scheduler stops running, no automatic syncs.

**Likelihood:** Low (scheduler is simple)

**Impact:** High (stale data, no updates)

**Symptoms:**
```
Last sync: 2 days ago
Scheduler log shows no recent runs
Dashboard data is outdated
```

**Detection:**
- Monitoring checks last sync time
- Alert if no sync in 36 hours
- User reports stale data

**Prevention:**
- ✅ Already implemented: node-cron scheduler
- 🔄 Add: Scheduler health check
- 🔄 Add: Alert if scheduler stops
- 🔄 Add: Watchdog to restart scheduler

**Recovery:**
1. Automatic: Restart scheduler on failure
2. Manual: Restart server
3. Manual: Trigger sync manually

**Implementation Priority:** MEDIUM

---

### 14. LLM API Rate Limit

**Description:** Too many AI questions hit rate limit, API returns errors.

**Likelihood:** Medium (depends on usage)

**Impact:** Low (AI questions fail, dashboard still works)

**Symptoms:**
```
Error 429: Too Many Requests
LLM API error: Rate limit exceeded
AI question returns error message
```

**Detection:**
- AI question mutation fails
- Log contains "429" or "rate limit"
- User sees error toast

**Prevention:**
- 🔄 Add: Rate limiting on client side
- 🔄 Add: Queue system for AI questions
- 🔄 Add: Exponential backoff on 429
- 🔄 Add: Cache frequent questions

**Recovery:**
1. Automatic: Retry with exponential backoff
2. Automatic: Show user-friendly error message
3. Manual: Upgrade LLM API tier if needed

**Implementation Priority:** LOW

---

### 15. Concurrent Sync Execution

**Description:** Two syncs run at same time (manual + auto, or double-trigger).

**Likelihood:** Very Low (rare race condition)

**Impact:** High (data corruption, partial writes, deadlocks)

**Symptoms:**
```
Sync script: Another sync is already running
Database deadlock detected
Dashboard shows mixed old/new data
```

**Detection:**
- Sync script detects lock file
- Database reports deadlock
- Log shows overlapping sync times

**Prevention:**
- 🔄 Add: Lock file mechanism
- 🔄 Add: Check for running sync before starting
- 🔄 Add: Mutex in sync scheduler
- 🔄 Add: Database transaction isolation

**Recovery:**
1. Automatic: Second sync waits for first to complete
2. Automatic: Lock file cleaned up after sync
3. Manual: Kill hung sync process and remove lock

**Implementation Priority:** HIGH

---

## Prevention Strategy Summary

### Tier 1: Critical Safeguards (Implement First)

1. **Sync Lock File** - Prevent concurrent syncs
2. **Pre-Sync Validation** - Check auth, files exist, disk space
3. **Post-Sync Integrity Check** - Verify data quality, item counts
4. **Database Backup** - Snapshot before each sync
5. **Automatic Rollback** - Restore backup on failure

### Tier 2: Important Safeguards

6. **Retry Logic** - Exponential backoff for transient failures
7. **Parser Fallbacks** - Try multiple patterns for document changes
8. **Partial Sync Handling** - Track and retry failed files
9. **Monitoring Dashboard** - Show sync health, last run, errors
10. **Automated Alerts** - Email/notification on failures

### Tier 3: Nice-to-Have Safeguards

11. **Data Quality Checks** - Detect anomalies, outliers
12. **Schema Version Check** - Validate database matches code
13. **Disk Space Monitoring** - Alert before running out
14. **Log Rotation** - Prevent log files from filling disk
15. **Rate Limit Handling** - Graceful degradation for AI API

---

## Implementation Roadmap

### Phase 1: Critical Protection (Week 1)
- [ ] Implement sync lock file
- [ ] Add pre-sync validation (auth, files, space)
- [ ] Add post-sync integrity checks
- [ ] Create database backup mechanism
- [ ] Implement automatic rollback

### Phase 2: Recovery & Monitoring (Week 2)
- [ ] Add retry logic with exponential backoff
- [ ] Implement partial sync tracking
- [ ] Create sync health monitoring endpoint
- [ ] Add automated failure alerts
- [ ] Build manual recovery procedures

### Phase 3: Advanced Protection (Week 3)
- [ ] Add parser fallback modes
- [ ] Implement data quality validation
- [ ] Add schema version checking
- [ ] Create disk space monitoring
- [ ] Implement log rotation

---

## Testing Plan

### Failure Simulation Tests

1. **Auth Expiry Test**
   - Invalidate rclone token
   - Run sync
   - Verify: Error detected, alert sent, old data retained

2. **Network Timeout Test**
   - Simulate network interruption during download
   - Verify: Retry logic works, sync completes eventually

3. **Partial Sync Test**
   - Make one source file unavailable
   - Verify: Other files sync, failed file tracked, alert sent

4. **Database Connection Test**
   - Kill database during sync
   - Verify: Transaction rolled back, data not corrupted

5. **Concurrent Sync Test**
   - Trigger two syncs simultaneously
   - Verify: Second sync waits, lock file prevents corruption

6. **Disk Space Test**
   - Fill disk to 95%
   - Verify: Sync aborts, alert sent, no corruption

7. **Malformed Document Test**
   - Corrupt a Word document
   - Verify: Parser skips file, uses cached data, alert sent

8. **Schema Drift Test**
   - Rename database column
   - Verify: Startup check fails, error message clear

---

## Monitoring Metrics

### Sync Health Metrics

- **Last Sync Time** - Timestamp of last successful sync
- **Sync Duration** - How long last sync took (target: <90s)
- **Success Rate** - % of successful syncs (target: >95%)
- **Error Rate** - # of errors per sync (target: 0)
- **Item Counts** - # of items per table (detect anomalies)
- **File Success Rate** - % of files synced successfully (target: 100%)

### Database Health Metrics

- **Connection Pool** - Active/idle connections
- **Query Performance** - Avg query time (target: <100ms)
- **Disk Usage** - Database size growth rate
- **Index Usage** - Verify indexes are being used

### System Health Metrics

- **Disk Space** - % used (alert at 80%)
- **Memory Usage** - Python process memory
- **CPU Usage** - Sync script CPU time
- **Network Latency** - Google Drive download speed

---

## Alert Conditions

### Critical Alerts (Immediate Action Required)

- ❌ Sync failed 3 times in a row
- ❌ No successful sync in 36 hours
- ❌ Database connection lost
- ❌ Disk space >90%
- ❌ Authentication expired

### Warning Alerts (Investigate Soon)

- ⚠️ Sync duration >120 seconds
- ⚠️ Partial sync (some files failed)
- ⚠️ Item count dropped >50%
- ⚠️ Parser warnings detected
- ⚠️ Disk space >80%

### Info Alerts (For Records)

- ℹ️ Sync completed successfully
- ℹ️ New data detected
- ℹ️ Scheduler restarted
- ℹ️ Manual sync triggered

---

## Recovery Procedures

### Procedure 1: Complete Sync Failure

**Symptoms:** Sync script exits with error, no data updated

**Steps:**
1. Check sync log for error message
2. Identify failure mode (auth, network, file, database)
3. Fix root cause (re-auth, wait for network, fix file, restart DB)
4. Trigger manual sync: `bash sync_all_data.sh`
5. Verify data updated in dashboard

**Estimated Time:** 5-30 minutes

### Procedure 2: Partial Sync

**Symptoms:** Some sections updated, others stale

**Steps:**
1. Check sync log for file-specific errors
2. Identify which files failed
3. Fix file-specific issues (permissions, corruption, missing)
4. Re-run sync for failed files only
5. Verify all sections updated

**Estimated Time:** 10-20 minutes

### Procedure 3: Data Corruption

**Symptoms:** Dashboard shows wrong data, duplicates, or garbled text

**Steps:**
1. Stop automatic syncs (prevent further corruption)
2. Restore database from last good backup
3. Identify corruption cause (parser bug, encoding, schema)
4. Fix root cause
5. Re-run sync with fix
6. Verify data correct
7. Re-enable automatic syncs

**Estimated Time:** 30-60 minutes

### Procedure 4: Authentication Expiry

**Symptoms:** rclone errors, 401 Unauthorized

**Steps:**
1. Re-authenticate rclone: `rclone config reconnect manus_google_drive`
2. Test connection: `rclone lsf manus_google_drive:`
3. Trigger manual sync
4. Verify sync succeeds

**Estimated Time:** 5 minutes

### Procedure 5: Database Rollback

**Symptoms:** Need to undo recent sync

**Steps:**
1. Identify backup timestamp: `ls -lh /backups/`
2. Stop sync scheduler
3. Restore backup: `mysql < backup_TIMESTAMP.sql`
4. Verify data restored
5. Fix issue that caused need for rollback
6. Re-enable scheduler

**Estimated Time:** 10-15 minutes

---

## Conclusion

This analysis identifies 15 potential failure modes and provides comprehensive prevention and recovery strategies. Implementation priority is:

1. **HIGH:** Sync lock, validation, integrity checks, backup/rollback
2. **MEDIUM:** Retry logic, monitoring, alerts, partial sync handling
3. **LOW:** Advanced checks, optimization, nice-to-have features

Next steps: Implement Tier 1 critical safeguards first, then build monitoring and alerting infrastructure.

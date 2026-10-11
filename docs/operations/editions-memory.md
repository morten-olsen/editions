# Editions memory investigation

The current recovery and resource evidence is below. Historical incident evidence
follows it. The preserved `prod/editions-data` PVC must not be changed or deleted.

## Recovery and sizing (2026-10-11, task b827f044)

Startup recovery now processes only extracted, unanalysed articles, without a
reset. It leaves completed scores and analysed timestamps untouched, including
scores from an earlier model. The scheduler holds due editions while analysis
runs and retries afterward. Failed inference cannot stamp analysis complete.

A read-only copy of the disabled production database contained 25,335 articles,
21,593 extracted pending articles, 19 focuses and no scores. A guarded local run
through the actual application startup, scheduler, job handlers and real models
completed all 410,267 similarity pairs and checkpointed all 21,593 articles.
Source refresh, extraction and scoring of newly ingested articles continued.
The 450-second run exited normally with 21,668 analysed articles and 411,692
scores; it published no empty editions (the original startup replay published
three). [Sanitized measurements](editions-memory-evidence.json) retain the counts
and peak, without database contents, URLs or credentials.

The production configuration resolves to **similarity**: the Docker image and
chart provide no classifier override. BART is optional for NLI/hybrid analysis;
it was explicitly exercised for sizing, without changing the production
strategy. Real BART classified the three largest stored articles against all
19 focuses (57 pairs), plus all 19 focuses during full-app startup. Every model
remains fp32; there is no quantization change.

Measured evidence:

| Run | RSS | Main JavaScript heap | Result |
|---|---:|---:|---|
| Original full configured analysis | 670 MiB sampled peak | 67 MiB | 410,267 pairs completed |
| Original startup, six minutes | 948 MiB sampled peak | 144 MiB | Private 65 MiB heap snapshot captured |
| Both models, original ONNX optimization | 3,817 MiB sampled | 33 MiB | Agent connection lost before classification completed; failed acceptance |
| Bounded BART, largest three articles | 2,538 MiB guarded peak | 41 MiB sampled | 57 pairs completed; worker heap ~38 MiB |
| Fixed application startup with both models | 2841 MiB guarded peak | 162 MiB sampled peak | Full pending analysis completed; refresh/extraction continued |

Private main and worker heap snapshots did **not** reproduce the reported
~1 GiB of retained JavaScript objects. Do not describe that historical heap
retainer as identified. The reproduced failures were native ONNX memory
pressure and BART losing its end token when an unusually token-dense article
was truncated. Graph optimization/arenas are disabled, inputs are bounded and
only one model is resident at a time. Corpus-sized reset ID arrays and repeated
native SQLite statement creation are also removed. The exact historical heap
retainer remains unverified.

The bounds are in [article-analysis.md](../article-analysis.md). Use a 3 GiB
application request, a 4 GiB hard limit, two CPUs and a 512 MiB Node heap ceiling.
The request covers the measured model/application peak with headroom; the hard
limit protects the node. This is subject to the live rollout and observation
below, rather than a claim that every workload has been exercised. Full-corpus
NLI, full-corpus network re-extraction, and 72-hour stability have not been
verified by the local acceptance run.

## Current recovery observation: 72 hours

Routine `851b61b0-0a26-4412-a49e-f6e7ce48938d` starts its clock at this rollout.
Every six hours, read continuous Prometheus RSS/working-set data, restart/last
state, the expected image digest, score coverage, job outcomes, node readiness
and host pressure. Use the rollout task comment as the digest/time baseline.

Pass only after 72 hours with at least 24 continuous stable hours: no OOM or
restart; successful recovery and advancing fetch/analysis timestamps; repaired
vectors and complete score coverage for extracted text-bearing articles;
healthy service and populated editions; final-24-hour RSS slope <=8 MiB/hour;
final-six-hour median <=128 MiB above the preceding six hours. With BART, expect
up to about 2.8 GiB RSS during bounded startup; ordinary similarity-only operation
may be lower. Missing telemetry is unverified.

Abort on OOM/restart/readiness loss, attributable node/control-plane pressure,
RSS or working set >3,277 MiB for five minutes, RSS slope >32 MiB/hour over six
hours after warm-up, MemAvailable <10 GiB for five minutes, sustained swap-out
or memory/I/O PSI full >1% for ten minutes, two failed analysis jobs, or persistent
invalid vectors. Disable through Git by renaming the chart to
`editions.disabled`, verify workload removal and the original preserved PVC,
and disable the routine. Never restore an earlier leaking image or waive a
threshold. At 72 hours, record pass/fail/unverified and disable the routine;
extend only for an incomplete stable window.

## Historical investigation

## Observations (2026-10-10)

- The workload is absent, node `compute` is Ready, and the 10 GiB PVC is Bound
  to `pvc-3aee7126-144a-4c58-b91d-caa06b42b6d0`, with the Argo CD sync option `Delete=false`. This protects against Argo CD
  deletion only; the underlying PV reclaim policy is `Delete`, so deleting the
  PVC directly would delete its data.
- Retained Prometheus data shows peak container RSS of 65,989,996,544 bytes,
  versus approximately 0.6 GB of file cache. The incident was process-memory growth.
- The disabled image digest is
  `sha256:9a618e4f7c879fea95e7af4b49626e3b0c1a2f34e9b74c031d5142a1970d89df`.
  Its OCI revision is `39651396c5a864a29a9076aedc6570672e48e990`, matching
  current main, and its runtime is Node 24.19.0.
- A one-minute synthetic run through `ReconcilerService.embed` with sequential
  identical input stabilized at 473.6 MB RSS after loading the real model. This
  does **not** reproduce or rule out the production leak.
- Eight concurrent requests with varied input lengths on the image's exact Node
  24.19.0 binary reached 503.4 MB RSS in a one-minute run. This short warm-up
  run cannot establish a long-term growth rate.
- Code inspection shows that scheduler ticks can enqueue refreshes for a source
  with an active refresh, and completed job GC runs only in `listByUser`.
  These are hypotheses, not a demonstrated explanation of 63 GiB.

## Next read-only probe

[editions-inspect.yaml](editions-inspect.yaml) is a proposed temporary pod, not a
GitOps workload. It opens SQLite directly in read-only mode without invoking
`DatabaseService`, migrations, the HTTP server, the scheduler or inference. It
prints only aggregate counts, timestamps and lengths; no article bodies, URLs,
user identities, credentials or configuration values. Both the mount and SQLite
connection are read-only. The pod has a 120-second deadline, 256 MiB hard limit,
500m CPU limit, no service-account token, no ports and no init container.
Istio injection is explicitly disabled on this pod.

Have Security and SRE review the exact manifest before creation. Run the server
admission dry-run before creating it and inspect the complete admitted
container/init-container list, images, ports, security contexts, token projections
and read-only volume mounts. Expect only the inspect container and no injected
containers or token projections. If SQLite cannot read its WAL on the
read-only mount, stop and report the failure; do not change volume permissions,
checkpoint the database, or retry with a writable mount.

```sh
kubectl create --dry-run=server -f docs/operations/editions-inspect.yaml -o json
kubectl create -f docs/operations/editions-inspect.yaml
kubectl -n prod logs editions-memory-inspect
kubectl -n prod delete pod editions-memory-inspect
```

Success is aggregate evidence to select a realistic local reproduction fixture.
Creation does not re-enable Editions. Cleanup deletes only this temporary pod.
Further instrumentation is reviewed separately; re-enabling still requires a
verified leak fix, measured requests/limits, a Node heap ceiling, a pinned image,
and at least 24 hours of observed memory stability.

## First probe and next hypothesis

The first reviewed probe completed in 11 seconds with exit code 0 and was deleted
by name. The original PVC remained Bound and the node Ready. It found 63 RSS
sources, all last fetched on September 10, 24,192 articles, 3,471 unextracted,
993 extracted but unanalysed, 19 focuses, and 20,721 embeddings totalling
31,827,456 bytes. Article content totals approximately 161 million characters;
this retained corpus alone does not explain 63 GiB process RSS.

A local reproduction using the real similarity step and SQLite found that a full
batch of non-finite embeddings never drains: a NaN dot product is bound as SQL
NULL, so the pair remains eligible forever. After 500 batches, all 100 pairs
still needed scoring; RSS grew from 86.1 MB to 125.6 MB. This demonstrates a
possible loop, not that the preserved production embeddings contain NaN.

The updated probe adds aggregate assignment counts/timestamps and a streaming
finite-value check over existing embedding BLOBs. It prints only counts of
malformed, non-finite and zero-norm vectors, never vectors or identifiers.
Resources, deadline, hardening, read-only access and cleanup remain unchanged.
This extension requires fresh review before execution.

## Confirmed incident pattern and fix

The second reviewed probe completed with exit code 0 in 14 seconds and was
removed by name. It found six non-finite vectors and 114 missing similarity
scores across nineteen focuses, with no malformed or zero-norm vectors.
Embedding updates stopped on September 10 at 07:02:40 UTC. This matches the
locally reproduced full-batch loop (the batch size is 100).

Running the exact original similarity code against SQLite repeated 7,708 batches
without draining its 100 pending pairs. RSS rose from 85 MB to 537 MB while heap
remained approximately 30 MB; the harness stopped at its 512 MiB guard. The
synchronous SQLite/promise loop keeps producing native statements without giving
the event loop a turn to release them, explaining the RSS growth and stalled
scheduler. The probe did not establish why the model originally emitted NaN.

The embedding step now scans stored vectors in bounded keyset pages, yielding
to the event loop between pages. It regenerates missing, stale or non-finite
vectors through the normal upsert, without deleting articles or running a schema
migration. Valid vectors are reused. New invalid model output and invalid or
incompatible similarity inputs are skipped per item, before a NULL score can be
written. Healthy items in the same batch and later batches continue. Similarity
uses an article/focus keyset cursor and yields to the event loop, so rejected
pairs cannot repeat during one run. Only a failure count and the first rejection
message are retained per step; the job reports failure after all reachable work
finishes. Database or inference exceptions still abort their step immediately.
Invalid existing vectors remain eligible for a bounded retry on the next run;
there is no persistent quarantine or schema change. A failed job or incomplete
score coverage must not be treated as successful recovery, even if the existing
mark-analysed phase has set an article timestamp.

Regression checks use the real pipeline and in-memory SQLite with fake model
functions: six invalid vectors across nineteen focuses, rejection of new NaN
output, and recovery with valid embeddings reused. The recovery fixture produces
171 finite article/focus scores and marks all nine fixture articles analysed.

Rollback keeps the chart disabled if symptoms recur and preserves the PVC.
Reverting source does not undo successfully regenerated derived vectors, and the
original leaking image must not be re-enabled. Deployment still requires a fixed
image digest, resource/heap limits, reviewer completion and the authorized
72-hour observation routine (six-hourly checks, at least 24 continuous stable
hours). Routine id: `851b61b0-0a26-4412-a49e-f6e7ce48938d`; it remains disabled
until the reviewed rollout is recorded.


## Superseded 2026-10-10 thresholds

These historical thresholds were superseded by the 2026-10-11 criteria above.
These were provisional acceptance thresholds, to be reviewed before enabling the
new digest. The 1536 MiB container limit and 256 MiB Node heap ceiling apply from
startup; no initialization grace permits an OOM or host-pressure event.
Record the rollout time, digest, PVC/PV identity and initial restart counters.
Check startup and the first analysis job immediately; then inspect continuous
Prometheus data at least every six hours. Missing telemetry is unverified.

Pass after 72 hours only if all of these hold:

- All six originally invalid vectors are repaired; aggregate invalid-vector and
  missing-similarity counts are zero for extracted, text-bearing articles with
  the current model. Analysis and source refresh jobs succeed and timestamps
  advance. No persistent rejected article is accepted as a successful recovery.
- No OOM, container restart, node Ready transition or control-plane restart
  during observation. The expected digest, requests, hard limits and heap
  ceiling remain present. The original PVC stays Bound to its original PV.
- After the initial two-hour recovery window, RSS and working set stay below
  1024 MiB. Over the final continuous 24 hours, the fitted RSS growth rate is
  at most 8 MiB/hour and the final six-hour median is no more than 128 MiB
  above the preceding six-hour median. Repeat the window if recovery is slower.
- Node MemAvailable stays above 10 GiB; swap-out is zero after startup. Memory
  and I/O PSI full averages remain below 1% over ten-minute windows. No active
  memory/disk-pressure alert, sustained major-fault or disk-queue increase,
  or pressure-induced application failures. Compare temperatures and API
  latency with the pre-rollout healthy baseline; unrelated failures get tasks.
- Service health and an authenticated edition generation succeed after startup
  and at the end; no user content or credentials are recorded in evidence.

Abort and disable the chart immediately on OOM, restart, node readiness loss,
control-plane restart, or attributable host-pressure alert. Also abort on RSS or
working set above 1228 MiB for five minutes, fitted RSS growth above 32 MiB/hour
for a six-hour window after warm-up, MemAvailable below 10 GiB for five minutes,
or sustained swap-out/PSI full above 1% for ten minutes. Two consecutive failed
analysis jobs, persistent invalid vectors or stalled source refreshes mean stop
recovery and report the cause; do not leave a poison article silently ignored.

Rollback renames the chart to `.disabled` through Git, verifies workload removal
and the preserved PVC, and disables the observation routine. Never restore the
old leaking digest. At 72 hours, record pass/fail/unverified, retain the evidence,
and disable the routine; extend observation only if the required stable window
is incomplete. This is observation, not permission to waive a failed threshold.

A subsequent startup on the completed local database preserved all 411,692 existing scores (hash and count), with no pending recovery job and 320 MiB peak RSS. The startup regression test separately exercises existing scores alongside pending articles.

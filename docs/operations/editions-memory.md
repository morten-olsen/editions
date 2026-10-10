# Editions memory investigation

Editions stays disabled until its September 2026 process-memory growth is explained
and fixed. The preserved `prod/editions-data` PVC must not be changed or deleted.

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
